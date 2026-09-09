import 'server-only';
import { PageStatus, TournamentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { processEmailQueue, releaseStuckJobs } from '@/lib/mail/queue';
import { pruneRateLimits } from '@/lib/ratelimit';
import { AUDIT_ACTIONS, recordSystemAudit } from '@/lib/audit';

/**
 * Kontrollierter Hintergrundlauf.
 *
 * Es gibt genau einen Intervalljob pro Serverprozess. Er erledigt terminierte
 * Veröffentlichungen, den E-Mail-Versand und die Aufbewahrungsfristen. Es
 * findet kein Polling externer Dienste statt.
 */

const TICK_INTERVAL_MS = 60_000;
const HOUSEKEEPING_INTERVAL_MS = 6 * 3600 * 1000;

const globalForScheduler = globalThis as unknown as {
  __swisshubScheduler?: { timer: NodeJS.Timeout; lastHousekeeping: number; running: boolean };
};

/** Veröffentlicht Seiten, deren Termin erreicht ist. */
async function publishDuePages(): Promise<number> {
  const now = new Date();

  const due = await prisma.page.findMany({
    where: { scheduledPublishAt: { not: null, lte: now }, status: { not: PageStatus.PUBLISHED }, archivedAt: null },
    include: { sections: { orderBy: { position: 'asc' } } },
  });

  for (const page of due) {
    const snapshot = {
      title: page.title,
      sections: page.sections.map((section) => ({
        id: section.id,
        type: section.type,
        visible: section.visible,
        data: section.data,
      })),
    };

    await prisma.$transaction([
      prisma.page.update({
        where: { id: page.id },
        data: {
          status: PageStatus.PUBLISHED,
          publishedContent: snapshot as never,
          publishedAt: now,
          scheduledPublishAt: null,
        },
      }),
      prisma.pageVersion.create({
        data: {
          pageId: page.id,
          version: (await nextVersionNumber(page.id)),
          changeType: 'scheduled-publish',
          label: 'Terminierte Veröffentlichung',
          content: snapshot as never,
        },
      }),
    ]);

    invalidateTags(CacheTag.pages, CacheTag.page(page.slug));
    await recordSystemAudit(
      AUDIT_ACTIONS.PUBLISH,
      'Page',
      `Terminierte Veröffentlichung der Seite „${page.title}“.`,
      { slug: page.slug },
      page.id,
    );
  }

  return due.length;
}

async function nextVersionNumber(pageId: string): Promise<number> {
  const latest = await prisma.pageVersion.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

/** Zieht Seiten zurück, deren Deaktivierungstermin erreicht ist. */
async function unpublishDuePages(): Promise<number> {
  const now = new Date();
  const due = await prisma.page.findMany({
    where: { scheduledUnpublishAt: { not: null, lte: now }, status: PageStatus.PUBLISHED },
    select: { id: true, slug: true, title: true },
  });

  for (const page of due) {
    await prisma.page.update({
      where: { id: page.id },
      data: { status: PageStatus.DRAFT, scheduledUnpublishAt: null },
    });
    invalidateTags(CacheTag.pages, CacheTag.page(page.slug));
    await recordSystemAudit(
      AUDIT_ACTIONS.UNPUBLISH,
      'Page',
      `Terminierte Deaktivierung der Seite „${page.title}“.`,
      { slug: page.slug },
      page.id,
    );
  }

  return due.length;
}

async function publishDueRecords(): Promise<number> {
  const now = new Date();
  let count = 0;

  const tournaments = await prisma.tournament.findMany({
    where: { scheduledPublishAt: { not: null, lte: now }, publishedAt: null },
    select: { id: true, slug: true, title: true, status: true },
  });

  for (const tournament of tournaments) {
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        publishedAt: now,
        scheduledPublishAt: null,
        ...(tournament.status === TournamentStatus.DRAFT ? { status: TournamentStatus.ANNOUNCED } : {}),
      },
    });
    invalidateTags(CacheTag.tournaments, CacheTag.tournament(tournament.slug));
    await recordSystemAudit(
      AUDIT_ACTIONS.PUBLISH,
      'Tournament',
      `Terminierte Veröffentlichung des Turniers „${tournament.title}“.`,
      { slug: tournament.slug },
      tournament.id,
    );
    count += 1;
  }

  const sponsors = await prisma.sponsor.updateMany({
    where: { scheduledPublishAt: { not: null, lte: now }, publishedAt: null },
    data: { publishedAt: now, scheduledPublishAt: null },
  });
  if (sponsors.count > 0) {
    invalidateTags(CacheTag.sponsors);
    count += sponsors.count;
  }

  const posts = await prisma.socialPost.updateMany({
    where: { scheduledPublishAt: { not: null, lte: now }, publishedAt: null },
    data: { publishedAt: now, scheduledPublishAt: null },
  });
  if (posts.count > 0) {
    invalidateTags(CacheTag.social);
    count += posts.count;
  }

  return count;
}

/** Setzt laufende Turniere anhand ihrer Termine automatisch fort. */
async function advanceTournamentStates(): Promise<number> {
  const now = new Date();

  const toRunning = await prisma.tournament.updateMany({
    where: {
      publishedAt: { not: null },
      archivedAt: null,
      status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.ANNOUNCED] },
      startsAt: { not: null, lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    data: { status: TournamentStatus.RUNNING },
  });

  if (toRunning.count > 0) invalidateTags(CacheTag.tournaments);
  return toRunning.count;
}

/** Aufbewahrungsfrist für Kontaktanfragen: anonymisieren statt löschen. */
async function applyContactRetention(): Promise<number> {
  const setting = await prisma.globalSetting.findUnique({ where: { key: 'contactRetentionDays' } });
  const days = typeof setting?.value === 'number' ? setting.value : 730;
  if (days <= 0) return 0;

  const threshold = new Date(Date.now() - days * 24 * 3600 * 1000);

  const expired = await prisma.contactRequest.findMany({
    where: { createdAt: { lt: threshold }, anonymizedAt: null },
    select: { id: true },
    take: 200,
  });

  if (expired.length === 0) return 0;
  const ids = expired.map((request) => request.id);

  await prisma.$transaction([
    prisma.contactAttachment.deleteMany({ where: { requestId: { in: ids } } }),
    prisma.contactRequest.updateMany({
      where: { id: { in: ids } },
      data: {
        name: 'Anonymisiert',
        email: 'anonymisiert@swisshub.invalid',
        organisation: null,
        message: 'Diese Anfrage wurde nach Ablauf der Aufbewahrungsfrist automatisch anonymisiert.',
        ipHash: null,
        userAgent: null,
        anonymizedAt: new Date(),
      },
    }),
  ]);

  await recordSystemAudit(
    AUDIT_ACTIONS.CONTACT_ANONYMISE,
    'ContactRequest',
    `${ids.length} Kontaktanfrage(n) nach Ablauf der Aufbewahrungsfrist anonymisiert.`,
    { retentionDays: days },
  );

  return ids.length;
}

async function pruneSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
  });
  return result.count;
}

async function pruneOAuthStates(): Promise<number> {
  const result = await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

export type TickResult = {
  publishedPages: number;
  unpublishedPages: number;
  publishedRecords: number;
  advancedTournaments: number;
  mail: { processed: number; sent: number; failed: number };
};

/** Ein Durchlauf. Auch manuell aus dem Dashboard auslösbar. */
export async function runSchedulerTick(): Promise<TickResult> {
  const [publishedPages, unpublishedPages, publishedRecords, advancedTournaments] = [
    await publishDuePages(),
    await unpublishDuePages(),
    await publishDueRecords(),
    await advanceTournamentStates(),
  ];

  await releaseStuckJobs();
  const mail = await processEmailQueue(15);

  return {
    publishedPages,
    unpublishedPages,
    publishedRecords,
    advancedTournaments,
    mail: { processed: mail.processed, sent: mail.sent, failed: mail.failed },
  };
}

export async function runHousekeeping(): Promise<void> {
  await applyContactRetention();
  await pruneRateLimits();
  await pruneSessions();
  await pruneOAuthStates();
}

/** Startet den Intervalljob genau einmal pro Prozess. */
export function startScheduler(): void {
  if (!env().ENABLE_BACKGROUND_JOBS) {
    console.info('[SwissHub] Hintergrundjobs sind per Konfiguration deaktiviert.');
    return;
  }
  if (globalForScheduler.__swisshubScheduler) return;

  const state = { timer: null as unknown as NodeJS.Timeout, lastHousekeeping: 0, running: false };

  const tick = async () => {
    if (state.running) return; // Überlappende Läufe vermeiden.
    state.running = true;
    try {
      await runSchedulerTick();

      if (Date.now() - state.lastHousekeeping > HOUSEKEEPING_INTERVAL_MS) {
        state.lastHousekeeping = Date.now();
        await runHousekeeping();
      }
    } catch (error) {
      console.error('[SwissHub] Fehler im Hintergrundlauf:', error);
    } finally {
      state.running = false;
    }
  };

  state.timer = setInterval(() => void tick(), TICK_INTERVAL_MS);
  state.timer.unref();
  globalForScheduler.__swisshubScheduler = state;

  console.info('[SwissHub] Hintergrundlauf gestartet (Intervall: 60 s).');
}
