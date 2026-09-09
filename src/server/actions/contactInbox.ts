'use server';

import { revalidatePath } from 'next/cache';
import { ContactPriority, ContactStatus, MessageDirection, RecipientKind } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { queueMail } from '@/lib/mail/queue';
import { renderLayout, renderQuotedText } from '@/lib/mail/templates';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { deleteStoredFile } from '@/lib/media';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { verifyTransport } from '@/lib/mail/transport';
import {
  checkbox,
  failure,
  integer,
  optionalText,
  runAction,
  success,
  text,
  type ActionState,
} from '@/server/actions/types';

/** Bearbeitung der Kontaktanfragen sowie Pflege der Benachrichtigungsempfänger. */

const statusValues = Object.values(ContactStatus) as [ContactStatus, ...ContactStatus[]];
const priorityValues = Object.values(ContactPriority) as [ContactPriority, ...ContactPriority[]];

export async function updateRequestAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.CONTACT_RESPOND);
    const id = text(formData, 'id');

    const request = await prisma.contactRequest.findUnique({
      where: { id },
      select: { reference: true, status: true },
    });
    if (!request) return failure('Die Anfrage wurde nicht gefunden.');

    const status = z.enum(statusValues).safeParse(text(formData, 'status'));
    const priority = z.enum(priorityValues).safeParse(text(formData, 'priority'));

    if (!status.success) return failure('Bitte prüfe die markierten Felder.', { status: 'Ungültiger Status.' });
    if (!priority.success) return failure('Bitte prüfe die markierten Felder.', { priority: 'Ungültige Priorität.' });

    const assignedToId = optionalText(formData, 'assignedToId');

    await prisma.contactRequest.update({
      where: { id },
      data: {
        status: status.data,
        priority: priority.data,
        assignedToId,
        ...(status.data === ContactStatus.CLOSED ? { closedAt: new Date() } : { closedAt: null }),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CONTACT_STATUS_CHANGE,
      entityType: 'ContactRequest',
      entityId: id,
      summary: `Anfrage ${request.reference}: Status ${request.status} → ${status.data}.`,
      metadata: { priority: priority.data, assignedToId },
      actor: user,
    });

    revalidatePath(`/admin/kontakt/${id}`);
    revalidatePath('/admin/kontakt');
    return success('Die Anfrage wurde aktualisiert.');
  });
}

export async function addNoteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.CONTACT_RESPOND);
    const requestId = text(formData, 'requestId');
    const body = text(formData, 'body');

    if (body.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { body: 'Bitte gib eine Notiz ein.' });
    }

    const request = await prisma.contactRequest.findUnique({ where: { id: requestId }, select: { reference: true } });
    if (!request) return failure('Die Anfrage wurde nicht gefunden.');

    await prisma.contactNote.create({ data: { requestId, authorId: user.id, body: body.slice(0, 4000) } });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'ContactRequest',
      entityId: requestId,
      summary: `Interne Notiz zu Anfrage ${request.reference} erfasst.`,
      actor: user,
    });

    revalidatePath(`/admin/kontakt/${requestId}`);
    return success('Die Notiz wurde gespeichert.');
  });
}

export async function replyAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.CONTACT_RESPOND);
    const requestId = text(formData, 'requestId');
    const body = text(formData, 'body');
    const subject = text(formData, 'subject');

    if (body.length < 10) {
      return failure('Bitte prüfe die markierten Felder.', { body: 'Die Antwort muss mindestens 10 Zeichen haben.' });
    }

    const request = await prisma.contactRequest.findUnique({
      where: { id: requestId },
      select: { reference: true, email: true, name: true, subject: true, anonymizedAt: true },
    });
    if (!request) return failure('Die Anfrage wurde nicht gefunden.');
    if (request.anonymizedAt) {
      return failure('Diese Anfrage wurde anonymisiert und kann nicht mehr beantwortet werden.');
    }

    const settings = await getSettings();

    const jobId = await queueMail({
      to: [request.email],
      replyTo: settings.mailReplyTo || settings.contactEmail || null,
      subject: subject || `Re: ${request.subject}`,
      html: renderLayout({
        title: subject || `Re: ${request.subject}`,
        intro: `Antwort auf deine Anfrage ${request.reference}`,
        appUrl: env().APP_URL,
        bodyHtml: renderQuotedText(body),
        footerNote: 'Du kannst direkt auf diese E-Mail antworten.',
      }),
      text: body,
      templateKey: 'contact-reply',
      context: request.reference,
    });

    if (!jobId) {
      return failure('Die Antwort konnte nicht eingeplant werden, weil die Empfängeradresse ungültig ist.');
    }

    await prisma.$transaction([
      prisma.contactMessage.create({
        data: {
          requestId,
          direction: MessageDirection.OUTBOUND,
          subject: subject || `Re: ${request.subject}`,
          body,
          authorId: user.id,
          emailJobId: jobId,
        },
      }),
      prisma.contactRequest.update({
        where: { id: requestId },
        data: { status: ContactStatus.ANSWERED, respondedAt: new Date() },
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.CONTACT_REPLY,
      entityType: 'ContactRequest',
      entityId: requestId,
      summary: `Antwort auf Anfrage ${request.reference} eingeplant.`,
      metadata: { emailJobId: jobId },
      actor: user,
    });

    revalidatePath(`/admin/kontakt/${requestId}`);
    return success(
      env().mailConfigured
        ? 'Die Antwort wurde in die Warteschlange gestellt und wird in Kürze versendet.'
        : 'Die Antwort wurde gespeichert. Sie kann erst versendet werden, wenn ein SMTP-Server konfiguriert ist.',
    );
  });
}

export async function anonymiseRequestAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.CONTACT_DELETE);
    const id = text(formData, 'id');
    const mode = text(formData, 'mode');

    const request = await prisma.contactRequest.findUnique({
      where: { id },
      select: { reference: true, attachments: { select: { storageKey: true } } },
    });
    if (!request) return failure('Die Anfrage wurde nicht gefunden.');

    for (const attachment of request.attachments) {
      await deleteStoredFile(attachment.storageKey).catch(() => undefined);
    }

    if (mode === 'loeschen') {
      await prisma.contactRequest.delete({ where: { id } });

      await recordAudit({
        action: AUDIT_ACTIONS.DELETE,
        entityType: 'ContactRequest',
        entityId: id,
        summary: `Anfrage ${request.reference} vollständig gelöscht.`,
        actor: user,
      });

      revalidatePath('/admin/kontakt');
      return success('Die Anfrage wurde gelöscht.');
    }

    await prisma.$transaction([
      prisma.contactAttachment.deleteMany({ where: { requestId: id } }),
      prisma.contactRequest.update({
        where: { id },
        data: {
          name: 'Anonymisiert',
          email: 'anonymisiert@swisshub.invalid',
          organisation: null,
          message: 'Diese Anfrage wurde auf Wunsch anonymisiert.',
          ipHash: null,
          userAgent: null,
          anonymizedAt: new Date(),
        },
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.CONTACT_ANONYMISE,
      entityType: 'ContactRequest',
      entityId: id,
      summary: `Anfrage ${request.reference} anonymisiert.`,
      actor: user,
    });

    revalidatePath(`/admin/kontakt/${id}`);
    revalidatePath('/admin/kontakt');
    return success('Die Anfrage wurde anonymisiert. Status und Verlauf bleiben für die Statistik erhalten.');
  });
}

// ---------------------------------------------------------------------------
// E-Mail-Empfänger, Kategorien und Vorlagen
// ---------------------------------------------------------------------------

export async function saveRecipientAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);

    const email = text(formData, 'email').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return failure('Bitte prüfe die markierten Felder.', { email: 'Bitte gib eine gültige E-Mail-Adresse an.' });
    }

    const kind = text(formData, 'kind') === 'CC' ? RecipientKind.CC : text(formData, 'kind') === 'BCC' ? RecipientKind.BCC : RecipientKind.TO;
    const existingId = optionalText(formData, 'id');
    const categoryIds = formData.getAll('categoryIds').filter((entry): entry is string => typeof entry === 'string');
    const allCategories = checkbox(formData, 'allCategories');

    const conflict = await prisma.emailRecipient.findFirst({
      where: { email, kind, ...(existingId ? { id: { not: existingId } } : {}) },
      select: { id: true },
    });
    if (conflict) {
      return failure('Bitte prüfe die markierten Felder.', {
        email: 'Diese Adresse ist für diesen Empfängertyp bereits erfasst.',
      });
    }

    const data = {
      email,
      kind,
      name: optionalText(formData, 'name'),
      active: checkbox(formData, 'active'),
      allCategories,
    };

    const recipient = existingId
      ? await prisma.emailRecipient.update({ where: { id: existingId }, data, select: { id: true } })
      : await prisma.emailRecipient.create({ data, select: { id: true } });

    await prisma.emailRecipientCategory.deleteMany({ where: { recipientId: recipient.id } });
    if (!allCategories && categoryIds.length > 0) {
      await prisma.emailRecipientCategory.createMany({
        data: categoryIds.map((categoryId) => ({ recipientId: recipient.id, categoryId })),
        skipDuplicates: true,
      });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.EMAIL_RECIPIENT_CHANGE,
      entityType: 'EmailRecipient',
      entityId: recipient.id,
      summary: `Benachrichtigungsempfänger ${email} (${kind}) ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      metadata: { allCategories, categories: categoryIds.length },
      actor: user,
    });

    revalidatePath('/admin/kontakt/empfaenger');
    return success('Der Empfänger wurde gespeichert.');
  });
}

export async function deleteRecipientAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);
    const id = text(formData, 'id');

    const recipient = await prisma.emailRecipient.findUnique({ where: { id }, select: { email: true, kind: true } });
    if (!recipient) return failure('Der Empfänger wurde nicht gefunden.');

    await prisma.emailRecipient.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.EMAIL_RECIPIENT_CHANGE,
      entityType: 'EmailRecipient',
      entityId: id,
      summary: `Benachrichtigungsempfänger ${recipient.email} (${recipient.kind}) entfernt.`,
      actor: user,
    });

    revalidatePath('/admin/kontakt/empfaenger');
    return success('Der Empfänger wurde entfernt.');
  });
}

export async function saveCategoryAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);

    const label = text(formData, 'label');
    if (label.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { label: 'Bitte gib eine Bezeichnung an.' });
    }

    const key = text(formData, 'key')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '');

    if (key.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { key: 'Bitte gib einen Schlüssel an.' });
    }

    const existingId = optionalText(formData, 'id');
    const conflict = await prisma.contactCategory.findFirst({
      where: { key, ...(existingId ? { id: { not: existingId } } : {}) },
      select: { id: true },
    });
    if (conflict) {
      return failure('Bitte prüfe die markierten Felder.', { key: 'Dieser Schlüssel wird bereits verwendet.' });
    }

    const data = {
      key,
      label,
      description: optionalText(formData, 'description'),
      active: checkbox(formData, 'active'),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
    };

    if (existingId) {
      await prisma.contactCategory.update({ where: { id: existingId }, data });
    } else {
      await prisma.contactCategory.create({ data });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'ContactCategory',
      entityId: existingId ?? undefined,
      summary: `Kontaktkategorie „${label}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    revalidatePath('/admin/kontakt/empfaenger');
    revalidatePath('/kontakt');
    return success('Die Kategorie wurde gespeichert.');
  });
}

export async function saveTemplateAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);
    const key = text(formData, 'key');
    const subject = text(formData, 'subject');
    const bodyMarkdown = text(formData, 'bodyMarkdown');

    if (subject.length < 3) {
      return failure('Bitte prüfe die markierten Felder.', { subject: 'Bitte gib einen Betreff an.' });
    }
    if (bodyMarkdown.length < 10) {
      return failure('Bitte prüfe die markierten Felder.', { bodyMarkdown: 'Bitte gib einen Text an.' });
    }

    await prisma.emailTemplate.upsert({
      where: { key },
      create: {
        key,
        name: text(formData, 'name') || key,
        subject,
        bodyMarkdown,
        active: checkbox(formData, 'active'),
      },
      update: { subject, bodyMarkdown, active: checkbox(formData, 'active') },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'EmailTemplate',
      summary: `E-Mail-Vorlage „${key}“ bearbeitet.`,
      actor: user,
    });

    revalidatePath('/admin/kontakt/empfaenger');
    return success('Die Vorlage wurde gespeichert.');
  });
}

export async function sendTestMailAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);

    const limit = await consumeRateLimit(RATE_LIMITS.testMail, user.id);
    if (!limit.allowed) {
      return failure('Es wurden zu viele Testmails versendet. Bitte warte einen Moment.');
    }

    const to = text(formData, 'to').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      return failure('Bitte prüfe die markierten Felder.', { to: 'Bitte gib eine gültige E-Mail-Adresse an.' });
    }

    const check = await verifyTransport();
    if (!check.ok) {
      return failure(`Der SMTP-Server ist nicht erreichbar: ${check.error}`);
    }

    const jobId = await queueMail({
      to: [to],
      subject: 'SwissHub – Testnachricht',
      html: renderLayout({
        title: 'Testnachricht',
        intro: 'Diese Nachricht bestätigt, dass der E-Mail-Versand funktioniert.',
        appUrl: env().APP_URL,
        bodyHtml: `<p>Wenn du diese Nachricht erhältst, ist die SMTP-Konfiguration korrekt.</p>`,
      }),
      templateKey: 'test',
    });

    await recordAudit({
      action: AUDIT_ACTIONS.EMAIL_TEST,
      entityType: 'EmailJob',
      entityId: jobId ?? undefined,
      summary: `Testmail an ${to} eingeplant.`,
      actor: user,
    });

    return success('Die Testmail wurde eingeplant. Sie wird innerhalb einer Minute versendet.');
  });
}
