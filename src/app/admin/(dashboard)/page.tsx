import Link from 'next/link';
import { ContactStatus, MetricType, PageStatus, SponsorStatus, TournamentStatus } from '@prisma/client';
import { PageHeader, Panel, StatCard, InfoBox } from '@/components/admin/ui';
import { requireUser } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSettings, publishedStats } from '@/lib/settings';
import { queueHealth } from '@/lib/mail/queue';
import { dailySeries, lastDays, totalsByType } from '@/lib/metrics';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { Icons } from '@/components/ui/Icon';
import { MetricSparkline } from '@/components/admin/MetricSparkline';

/**
 * Startübersicht des Dashboards.
 *
 * Zeigt ausschliesslich echte Daten aus der Datenbank. Bereiche ohne
 * Berechtigung werden nicht geladen und nicht angezeigt.
 */

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboardPage() {
  const user = await requireUser();
  const settings = await getSettings();

  const canPages = userHasPermission(user, PERMISSIONS.PAGES_VIEW);
  const canTournaments = userHasPermission(user, PERMISSIONS.TOURNAMENTS_VIEW);
  const canSponsors = userHasPermission(user, PERMISSIONS.SPONSORS_VIEW);
  const canContact = userHasPermission(user, PERMISSIONS.CONTACT_READ);
  const canMetrics = userHasPermission(user, PERMISSIONS.METRICS_VIEW);
  const canAudit = userHasPermission(user, PERMISSIONS.AUDIT_VIEW);
  const canSystem = userHasPermission(user, PERMISSIONS.BACKUPS_MANAGE);

  const range = lastDays(30);

  const [
    draftPages,
    scheduledPages,
    upcomingTournaments,
    newRequests,
    openRequests,
    activeSponsors,
    recentPosts,
    recentAudit,
    mail,
    metrics,
    pageViewSeries,
  ] = await Promise.all([
    canPages ? prisma.page.count({ where: { status: PageStatus.DRAFT, archivedAt: null } }) : 0,
    canPages
      ? prisma.page.findMany({
          where: { scheduledPublishAt: { not: null } },
          orderBy: { scheduledPublishAt: 'asc' },
          take: 5,
          select: { id: true, title: true, scheduledPublishAt: true },
        })
      : [],
    canTournaments
      ? prisma.tournament.findMany({
          where: {
            archivedAt: null,
            status: {
              in: [
                TournamentStatus.ANNOUNCED,
                TournamentStatus.REGISTRATION_OPEN,
                TournamentStatus.REGISTRATION_CLOSED,
                TournamentStatus.RUNNING,
              ],
            },
          },
          orderBy: { startsAt: 'asc' },
          take: 5,
          select: { id: true, title: true, startsAt: true, status: true, publishedAt: true },
        })
      : [],
    canContact ? prisma.contactRequest.count({ where: { status: ContactStatus.NEW, archivedAt: null } }) : 0,
    canContact
      ? prisma.contactRequest.findMany({
          where: { status: { in: [ContactStatus.NEW, ContactStatus.IN_PROGRESS] }, archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            reference: true,
            subject: true,
            name: true,
            createdAt: true,
            status: true,
            category: { select: { label: true } },
          },
        })
      : [],
    canSponsors
      ? prisma.sponsor.count({ where: { status: SponsorStatus.ACTIVE, publishedAt: { not: null }, archivedAt: null } })
      : 0,
    prisma.socialPost.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      select: { id: true, title: true, platform: true, publishedAt: true },
    }),
    canAudit
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { id: true, actorLabel: true, summary: true, createdAt: true },
        })
      : [],
    canSystem ? queueHealth() : null,
    canMetrics ? totalsByType(range) : null,
    canMetrics ? dailySeries(MetricType.PAGE_VIEW, range) : [],
  ]);

  const stats = publishedStats(settings);
  const warnings: string[] = [];

  if (settings.maintenanceMode) warnings.push('Der Wartungsmodus ist aktiv – die Website ist für Besucher gesperrt.');
  if (!settings.discordInviteUrl) warnings.push('Es ist kein Discord-Einladungslink hinterlegt.');
  if (!settings.legalAddress) warnings.push('Im Impressum fehlt die Adresse des Vereins.');
  if (!env().mailConfigured) warnings.push('Es ist kein SMTP-Server konfiguriert – E-Mails werden nicht versendet.');
  if (mail && mail.failed > 0) warnings.push(`${mail.failed} E-Mail(s) konnten nicht zugestellt werden.`);
  if (stats.length === 0) warnings.push('Es sind keine Community-Zahlen veröffentlicht.');

  return (
    <>
      <PageHeader
        title={`Willkommen, ${user.displayName}`}
        description="Übersicht über Inhalte, Anfragen und den Zustand der Website."
        actions={
          <Link href="/" target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Website ansehen
            <Icons.external size={13} />
          </Link>
        }
      />

      <div className="space-y-6">
        {warnings.length > 0 ? (
          <InfoBox tone="warning" title="Hinweise">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </InfoBox>
        ) : (
          <InfoBox tone="success" title="Alles im grünen Bereich">
            Es liegen keine offenen Systemhinweise vor.
          </InfoBox>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {canContact ? (
            <StatCard
              label="Neue Anfragen"
              value={newRequests}
              hint="Noch nicht bearbeitet"
              href="/admin/kontakt?status=NEW"
              tone={newRequests > 0 ? 'warning' : 'default'}
            />
          ) : null}
          {canPages ? (
            <StatCard label="Entwürfe" value={draftPages} hint="Nicht veröffentlichte Seiten" href="/admin/seiten" />
          ) : null}
          {canTournaments ? (
            <StatCard
              label="Anstehende Turniere"
              value={upcomingTournaments.length}
              hint="Angekündigt oder laufend"
              href="/admin/turniere"
            />
          ) : null}
          {canSponsors ? (
            <StatCard label="Aktive Partner" value={activeSponsors} hint="Veröffentlicht" href="/admin/sponsoren" />
          ) : null}
        </div>

        {canMetrics && metrics ? (
          <Panel
            title="Website-Statistik (30 Tage)"
            description="Anonyme, tagesweise aggregierte Zahlen ohne Cookies und ohne externe Dienste."
            actions={
              <Link href="/admin/statistik" className="btn-secondary btn-sm">
                Details
              </Link>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Seitenaufrufe</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-ink)]">
                  {formatNumber(metrics.PAGE_VIEW + metrics.TOURNAMENT_VIEW)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Discord-Klicks</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-brand-text)]">
                  {formatNumber(metrics.DISCORD_CLICK)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Social-Klicks</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-ink)]">{formatNumber(metrics.SOCIAL_CLICK)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Kontaktanfragen</p>
                <p className="mt-1 text-xl font-bold text-[var(--color-ink)]">
                  {formatNumber(metrics.CONTACT_SUBMISSION)}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <MetricSparkline series={pageViewSeries} label="Seitenaufrufe pro Tag" />
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {canContact ? (
            <Panel
              title="Offene Anfragen"
              actions={
                <Link href="/admin/kontakt" className="btn-secondary btn-sm">
                  Alle ansehen
                </Link>
              }
            >
              {openRequests.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
                  Es sind keine offenen Anfragen vorhanden.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {openRequests.map((request) => (
                    <li key={request.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={`/admin/kontakt/${request.id}`} className="group block">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand-text)]">
                          {request.subject}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-ink-subtle)]">
                          {request.reference} · {request.name} · {request.category?.label ?? 'Ohne Kategorie'} ·{' '}
                          {formatDate(request.createdAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {canTournaments ? (
            <Panel
              title="Nächste Turniere"
              actions={
                <Link href="/admin/turniere" className="btn-secondary btn-sm">
                  Verwalten
                </Link>
              }
            >
              {upcomingTournaments.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
                  Es sind keine Turniere geplant.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {upcomingTournaments.map((tournament) => (
                    <li key={tournament.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={`/admin/turniere/${tournament.id}`} className="group block">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand-text)]">
                          {tournament.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                          {tournament.startsAt ? formatDateTime(tournament.startsAt) : 'Ohne Termin'} ·{' '}
                          {tournament.publishedAt ? 'veröffentlicht' : 'nicht veröffentlicht'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          {canPages ? (
            <Panel title="Geplante Veröffentlichungen">
              {scheduledPages.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
                  Es sind keine Veröffentlichungen terminiert.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {scheduledPages.map((page) => (
                    <li key={page.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={`/admin/seiten/${page.id}`} className="group block">
                        <p className="truncate text-sm font-medium text-[var(--color-ink)] group-hover:text-[var(--color-brand-text)]">
                          {page.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                          {formatDateTime(page.scheduledPublishAt)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          <Panel title="Zuletzt veröffentlichte Social-Beiträge">
            {recentPosts.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
                Es sind noch keine Beiträge veröffentlicht.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)]">
                {recentPosts.map((post) => (
                  <li key={post.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="truncate text-sm text-[var(--color-ink)]">{post.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-subtle)]">
                      {post.platform} · {formatDate(post.publishedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {canAudit ? (
            <Panel
              title="Letzte Änderungen"
              className="lg:col-span-2"
              actions={
                <Link href="/admin/audit" className="btn-secondary btn-sm">
                  Audit-Log
                </Link>
              }
            >
              {recentAudit.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
                  Es sind noch keine Änderungen protokolliert.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {recentAudit.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 py-2.5 text-sm first:pt-0 last:pb-0">
                      <span className="text-[var(--color-ink-muted)]">{entry.summary}</span>
                      <span className="text-xs text-[var(--color-ink-subtle)]">
                        {entry.actorLabel} · {formatDateTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
