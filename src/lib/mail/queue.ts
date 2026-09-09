import 'server-only';
import { EmailJobStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getTransport, isMailConfigured, sanitiseHeaderValue } from '@/lib/mail/transport';
import { htmlToPlainText } from '@/lib/mail/templates';

/**
 * Persistente E-Mail-Warteschlange.
 *
 * Ein Request stellt nur einen Auftrag ein und wird nie durch den SMTP-Versand
 * blockiert. Ein Hintergrundlauf verarbeitet die Aufträge mit begrenzter
 * Nebenläufigkeit und exponentiellem Backoff. Der Zustellstatus ist im
 * Dashboard einsehbar.
 */

export type QueueMailInput = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  context?: string;
  scheduledFor?: Date;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseAddresses(addresses: string[] | undefined): string[] {
  if (!addresses) return [];
  const unique = new Set<string>();
  for (const address of addresses) {
    const value = address.trim().toLowerCase();
    if (EMAIL_PATTERN.test(value)) unique.add(value);
  }
  return [...unique];
}

export async function queueMail(input: QueueMailInput): Promise<string | null> {
  const to = normaliseAddresses(input.to);
  if (to.length === 0) return null;

  const job = await prisma.emailJob.create({
    data: {
      toAddresses: to,
      ccAddresses: normaliseAddresses(input.cc),
      bccAddresses: normaliseAddresses(input.bcc),
      replyTo: input.replyTo ? sanitiseHeaderValue(input.replyTo) : null,
      subject: sanitiseHeaderValue(input.subject).slice(0, 200),
      bodyHtml: input.html,
      bodyText: input.text ?? htmlToPlainText(input.html),
      templateKey: input.templateKey ?? null,
      context: input.context ?? null,
      scheduledFor: input.scheduledFor ?? new Date(),
    },
    select: { id: true },
  });

  return job.id;
}

/** Wartezeit vor dem nächsten Versuch: 1, 2, 4, 8 … Minuten (max. 2 Stunden). */
function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 60_000, 2 * 3600 * 1000);
}

/**
 * Beansprucht einen Auftrag exklusiv. `FOR UPDATE SKIP LOCKED` verhindert, dass
 * zwei parallele Läufe dieselbe E-Mail versenden.
 */
async function claimNextJob(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      UPDATE "EmailJob"
      SET "status" = ${EmailJobStatus.PROCESSING}::"EmailJobStatus",
          "lockedAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id" FROM "EmailJob"
        WHERE "status" = ${EmailJobStatus.PENDING}::"EmailJobStatus"
          AND "scheduledFor" <= NOW()
        ORDER BY "scheduledFor" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id";
    `,
  );

  return rows[0]?.id ?? null;
}

export type QueueRunResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

export async function processEmailQueue(maxJobs = 10): Promise<QueueRunResult> {
  if (!isMailConfigured()) {
    return { processed: 0, sent: 0, failed: 0, skipped: true, reason: 'SMTP ist nicht konfiguriert.' };
  }

  const transport = getTransport();
  if (!transport) {
    return { processed: 0, sent: 0, failed: 0, skipped: true, reason: 'Kein SMTP-Transport verfügbar.' };
  }

  const config = env();
  const from = `${sanitiseHeaderValue(config.MAIL_FROM_NAME)} <${config.MAIL_FROM_ADDRESS}>`;
  let sent = 0;
  let failed = 0;
  let processed = 0;

  for (let index = 0; index < maxJobs; index += 1) {
    const jobId = await claimNextJob();
    if (!jobId) break;

    processed += 1;
    const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
    if (!job) continue;

    try {
      await transport.sendMail({
        from,
        to: job.toAddresses,
        cc: job.ccAddresses.length > 0 ? job.ccAddresses : undefined,
        bcc: job.bccAddresses.length > 0 ? job.bccAddresses : undefined,
        replyTo: job.replyTo ?? undefined,
        subject: job.subject,
        html: job.bodyHtml,
        text: job.bodyText,
      });

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lockedAt: null,
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const attempts = job.attempts + 1;
      const exhausted = attempts >= job.maxAttempts;
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim Versand.';

      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? EmailJobStatus.FAILED : EmailJobStatus.PENDING,
          attempts,
          lockedAt: null,
          // Fehlermeldungen können Adressen enthalten – auf das Nötige kürzen.
          lastError: message.slice(0, 500),
          scheduledFor: exhausted ? job.scheduledFor : new Date(Date.now() + backoffMs(attempts)),
        },
      });
      failed += 1;
    }
  }

  return { processed, sent, failed, skipped: false };
}

/** Gibt Aufträge frei, die durch einen Absturz in PROCESSING hängengeblieben sind. */
export async function releaseStuckJobs(olderThanMinutes = 15): Promise<number> {
  const threshold = new Date(Date.now() - olderThanMinutes * 60_000);
  const result = await prisma.emailJob.updateMany({
    where: { status: EmailJobStatus.PROCESSING, lockedAt: { lt: threshold } },
    data: { status: EmailJobStatus.PENDING, lockedAt: null },
  });
  return result.count;
}

export async function queueHealth(): Promise<{
  pending: number;
  failed: number;
  sentLast24h: number;
  oldestPendingAt: Date | null;
}> {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [pending, failed, sentLast24h, oldest] = await Promise.all([
    prisma.emailJob.count({ where: { status: EmailJobStatus.PENDING } }),
    prisma.emailJob.count({ where: { status: EmailJobStatus.FAILED } }),
    prisma.emailJob.count({ where: { status: EmailJobStatus.SENT, sentAt: { gte: dayAgo } } }),
    prisma.emailJob.findFirst({
      where: { status: EmailJobStatus.PENDING },
      orderBy: { scheduledFor: 'asc' },
      select: { scheduledFor: true },
    }),
  ]);

  return { pending, failed, sentLast24h, oldestPendingAt: oldest?.scheduledFor ?? null };
}
