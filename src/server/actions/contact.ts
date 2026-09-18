'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { MessageDirection, MetricType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { hashIp, sha256 } from '@/lib/crypto';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { verifyCaptcha } from '@/lib/captcha';
import { getSettings } from '@/lib/settings';
import { queueMail } from '@/lib/mail/queue';
import { renderDefinitionList, renderLayout, renderQuotedText, renderTemplateBody } from '@/lib/mail/templates';
import { recordMetric } from '@/lib/metrics';
import { storeUpload, MediaValidationError } from '@/lib/media';
import { contactFormSchema, HONEYPOT_FIELD, type ContactFormState } from '@/lib/validation/contact';

/**
 * Verarbeitet eine Kontaktanfrage.
 *
 * Schutzmassnahmen: Rate Limiting pro IP, Honeypot-Feld, optionales CAPTCHA,
 * serverseitige Validierung und geprüfte Dateianhänge. Interne
 * Empfängeradressen werden nie an den Browser übermittelt.
 */

const GENERIC_ERROR =
  'Deine Anfrage konnte gerade nicht gespeichert werden. Bitte versuche es in einigen Minuten erneut.';

function createReference(): string {
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `SH-${datePart}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  if (!env().TRUST_PROXY) return null;
  const forwarded = headerList.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip') ?? null;
}

export async function submitContactRequest(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const settings = await getSettings();
  const ip = await clientIp();
  const identifier = hashIp(ip) ?? 'unknown';

  // 1. Rate Limiting – schützt vor Massenversand und Formularmissbrauch.
  const burst = await consumeRateLimit(RATE_LIMITS.contactFormBurst, identifier);
  const hourly = await consumeRateLimit(RATE_LIMITS.contactForm, identifier);

  if (!burst.allowed || !hourly.allowed) {
    const wait = Math.max(burst.retryAfterSeconds, hourly.retryAfterSeconds);
    const minutes = Math.max(1, Math.ceil(wait / 60));
    return {
      status: 'error',
      message: `Du hast in kurzer Zeit mehrere Anfragen gesendet. Bitte versuche es in etwa ${minutes} Minute(n) erneut.`,
    };
  }

  // 2. Honeypot: Für Menschen unsichtbar, von Bots häufig ausgefüllt.
  //    Wir melden bewusst Erfolg, ohne etwas zu speichern.
  if ((formData.get(HONEYPOT_FIELD) as string | null)?.trim()) {
    return {
      status: 'success',
      message: 'Vielen Dank für deine Nachricht. Wir melden uns so bald wie möglich.',
    };
  }

  // 3. Optionales CAPTCHA
  if (settings.contactCaptchaEnabled) {
    const captcha = await verifyCaptcha((formData.get('cf-turnstile-response') as string | null) ?? null, ip);
    if (!captcha.ok) {
      return { status: 'error', message: captcha.reason, fieldErrors: { captcha: captcha.reason } };
    }
  }

  // 4. Validierung
  const parsed = contactFormSchema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    organisation: formData.get('organisation') ?? '',
    category: formData.get('category') ?? '',
    subject: formData.get('subject') ?? '',
    message: formData.get('message') ?? '',
    privacy: formData.get('privacy') ?? false,
  });

  if (!parsed.success) {
    const fieldErrors: ContactFormState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) {
        Object.assign(fieldErrors, { [key]: issue.message });
      }
    }
    return {
      status: 'error',
      message: 'Bitte prüfe die markierten Felder.',
      fieldErrors,
    };
  }

  const values = parsed.data;

  const category = await prisma.contactCategory.findFirst({
    where: { key: values.category, active: true },
  });

  if (!category) {
    return {
      status: 'error',
      message: 'Bitte prüfe die markierten Felder.',
      fieldErrors: { category: 'Diese Kategorie steht nicht zur Verfügung.' },
    };
  }

  // 5. Optionaler Anhang
  const attachmentFile = settings.contactAttachmentsEnabled ? (formData.get('attachment') as File | null) : null;
  let storedAttachment: { storageKey: string; mimeType: string; byteSize: number; checksum: string } | null = null;

  if (attachmentFile && attachmentFile.size > 0) {
    try {
      const buffer = Buffer.from(await attachmentFile.arrayBuffer());
      const stored = await storeUpload(buffer, { subdirectory: 'kontakt' });
      storedAttachment = {
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        byteSize: stored.byteSize,
        checksum: stored.checksum,
      };
    } catch (error) {
      const message =
        error instanceof MediaValidationError
          ? error.message
          : 'Der Anhang konnte nicht verarbeitet werden. Bitte versuche es ohne Datei erneut.';
      return { status: 'error', message, fieldErrors: { attachment: message } };
    }
  }

  const reference = createReference();
  const headerList = await headers();

  try {
    const request = await prisma.contactRequest.create({
      data: {
        reference,
        name: values.name,
        email: values.email.toLowerCase(),
        organisation: values.organisation,
        subject: values.subject,
        categoryId: category.id,
        message: values.message,
        privacyAcceptedAt: new Date(),
        ipHash: hashIp(ip),
        userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
        messages: {
          create: {
            direction: MessageDirection.INBOUND,
            subject: values.subject,
            body: values.message,
          },
        },
        ...(storedAttachment
          ? {
              attachments: {
                create: {
                  storageKey: storedAttachment.storageKey,
                  originalName: (attachmentFile?.name ?? 'anhang').slice(0, 150),
                  mimeType: storedAttachment.mimeType,
                  byteSize: storedAttachment.byteSize,
                  checksum: storedAttachment.checksum,
                },
              },
            }
          : {}),
      },
      select: { id: true, reference: true },
    });

    // 6. Benachrichtigung an die für diese Kategorie zuständigen Empfänger.
    const recipients = await prisma.emailRecipient.findMany({
      where: {
        active: true,
        OR: [{ allCategories: true }, { categories: { some: { categoryId: category.id } } }],
      },
      select: { email: true, kind: true },
    });

    const to = recipients.filter((entry) => entry.kind === 'TO').map((entry) => entry.email);
    const cc = recipients.filter((entry) => entry.kind === 'CC').map((entry) => entry.email);
    const bcc = recipients.filter((entry) => entry.kind === 'BCC').map((entry) => entry.email);

    let notificationJobId: string | null = null;

    if (to.length > 0 || cc.length > 0 || bcc.length > 0) {
      const bodyHtml = renderLayout({
        title: `Neue Kontaktanfrage: ${values.subject}`,
        intro: `Referenz ${request.reference} · Kategorie ${category.label}`,
        appUrl: env().APP_URL,
        bodyHtml: [
          renderDefinitionList([
            { label: 'Name', value: values.name },
            { label: 'E-Mail', value: values.email },
            { label: 'Organisation', value: values.organisation ?? '' },
            { label: 'Kategorie', value: category.label },
            { label: 'Betreff', value: values.subject },
            { label: 'Anhang', value: storedAttachment ? (attachmentFile?.name ?? 'vorhanden') : '' },
          ]),
          renderQuotedText(values.message),
          `<p style="margin:20px 0 0;"><a href="${env().APP_URL}/admin/kontakt/${request.id}" style="color:#ff6b70;">Anfrage im Dashboard öffnen</a></p>`,
        ].join(''),
        // Die Domain stammt aus der Konfiguration – sonst bliebe hier bei einem
        // Domainwechsel die alte Adresse stehen.
        footerNote: `Diese Nachricht wurde automatisch durch das Kontaktformular von ${new URL(env().APP_URL).host} erzeugt.`,
      });

      notificationJobId = await queueMail({
        to: to.length > 0 ? to : cc.length > 0 ? cc : bcc,
        cc: to.length > 0 ? cc : [],
        bcc,
        replyTo: values.email,
        subject: `[SwissHub] ${category.label}: ${values.subject}`,
        html: bodyHtml,
        templateKey: 'contact-notification',
        context: request.reference,
      });
    }

    // 7. Optionale Eingangsbestätigung an die anfragende Person.
    let confirmationJobId: string | null = null;

    if (settings.contactConfirmationEnabled) {
      const template = await prisma.emailTemplate.findFirst({
        where: { key: 'contact-confirmation', active: true },
      });

      const variables = {
        name: values.name,
        subject: values.subject,
        reference: request.reference,
        kategorie: category.label,
        siteName: settings.siteName,
      };

      const rendered = template
        ? renderTemplateBody(template.bodyMarkdown, variables)
        : {
            html: `<p>Danke für deine Nachricht. Wir haben deine Anfrage erhalten und melden uns so bald wie möglich.</p>`,
            text: 'Danke für deine Nachricht. Wir haben deine Anfrage erhalten und melden uns so bald wie möglich.',
          };

      const subjectTemplate = template?.subject ?? 'Wir haben deine Anfrage erhalten ({{reference}})';
      const subject = Object.entries(variables).reduce(
        (accumulator, [key, value]) => accumulator.replaceAll(`{{${key}}}`, value),
        subjectTemplate,
      );

      confirmationJobId = await queueMail({
        to: [values.email],
        replyTo: settings.mailReplyTo || settings.contactEmail || null,
        subject,
        html: renderLayout({
          title: 'Wir haben deine Anfrage erhalten',
          appUrl: env().APP_URL,
          bodyHtml: `${rendered.html}${renderDefinitionList([
            { label: 'Referenz', value: request.reference },
            { label: 'Kategorie', value: category.label },
            { label: 'Betreff', value: values.subject },
          ])}${renderQuotedText(values.message)}`,
          footerNote:
            'Bitte antworte nicht auf diese automatische Bestätigung – nutze bei Rückfragen unser Kontaktformular oder den Discord-Support.',
        }),
        text: rendered.text,
        templateKey: 'contact-confirmation',
        context: request.reference,
      });
    }

    if (notificationJobId || confirmationJobId) {
      await prisma.contactRequest.update({
        where: { id: request.id },
        data: { notificationJobId, confirmationJobId },
      });
    }

    await recordMetric(MetricType.CONTACT_SUBMISSION, category.key);

    return {
      status: 'success',
      message: 'Vielen Dank für deine Nachricht. Wir melden uns so bald wie möglich.',
      reference: request.reference,
    };
  } catch (error) {
    // Fehlerdetails bleiben im Serverlog; nach aussen geht eine neutrale Meldung.
    console.error('Kontaktanfrage konnte nicht gespeichert werden:', {
      reference,
      digest: sha256(String(error)).slice(0, 12),
    });
    return { status: 'error', message: GENERIC_ERROR };
  }
}
