import type { Metadata } from 'next';
import { TournamentStatus } from '@prisma/client';
import { FilterLink } from '@/components/site/FilterLink';
import { TournamentCard } from '@/components/site/TournamentCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/site/JsonLd';
import { PageHero } from '@/components/site/PageHero';
import { revealProps } from '@/components/visual/Reveal';
import { getTournamentGames, getVisiblePublicTournaments, PAST_STATUSES, UPCOMING_STATUSES } from '@/lib/content/queries';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { getSettings } from '@/lib/settings';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/featureFlags';
import { safeUrl } from '@/lib/sanitize';

/**
 * Turnierübersicht mit Filterung nach Status und Spiel.
 *
 * Die Filter arbeiten über die URL und funktionieren daher auch ohne
 * JavaScript. Die Liste selbst wird serverseitig gerendert.
 */

type PageProps = {
  searchParams: Promise<{ status?: string; spiel?: string }>;
};

const STATUS_FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'anstehend', label: 'Anstehend' },
  { key: 'laufend', label: 'Laufend' },
  { key: 'vergangen', label: 'Archiv', requiresArchive: true },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Gaming-Turniere in der Schweiz',
    description:
      'Aktuelle und vergangene Turniere von SwissHub: Counter-Strike 2, League of Legends, Valorant, Apex Legends und mehr – organisiert von der Schweizer Gaming-Community.',
    path: '/turniere',
  });
}

function matchesStatus(status: TournamentStatus, filter: string): boolean {
  if (filter === 'anstehend') return UPCOMING_STATUSES.includes(status);
  if (filter === 'laufend') return status === TournamentStatus.RUNNING;
  if (filter === 'vergangen') return PAST_STATUSES.includes(status);
  return true;
}

export default async function TournamentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const statusFilter = STATUS_FILTERS.some((filter) => filter.key === params.status) ? (params.status as string) : 'alle';
  const gameFilter = params.spiel ?? 'alle';

  // Ist das Archiv abgeschaltet, erscheinen vergangene Turniere weder in der
  // Liste noch als Filter.
  const [all, games, settings, archiveEnabled] = await Promise.all([
    getVisiblePublicTournaments(),
    getTournamentGames(),
    getSettings(),
    isFeatureEnabled(FEATURE_FLAGS.tournamentArchive),
  ]);

  const statusFilters = STATUS_FILTERS.filter((filter) => archiveEnabled || !('requiresArchive' in filter));

  const filtered = all.filter(
    (tournament) =>
      matchesStatus(tournament.status, statusFilter) &&
      (gameFilter === 'alle' || tournament.game?.slug === gameFilter),
  );

  // Anstehende zuerst aufsteigend, Archiv absteigend – so steht immer das
  // Relevanteste oben.
  const sorted = [...filtered].sort((a, b) => {
    const aUpcoming = UPCOMING_STATUSES.includes(a.status) || a.status === TournamentStatus.RUNNING;
    const bUpcoming = UPCOMING_STATUSES.includes(b.status) || b.status === TournamentStatus.RUNNING;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;

    const aTime = a.startsAt?.getTime() ?? 0;
    const bTime = b.startsAt?.getTime() ?? 0;
    return aUpcoming ? aTime - bTime : bTime - aTime;
  });

  const running = all.filter((tournament) => tournament.status === TournamentStatus.RUNNING).length;

  // Ab zwei Treffern wird das erste Turnier gross dargestellt.
  const [highlight, rest] = sorted.length > 1 ? [sorted[0], sorted.slice(1)] : [null, sorted];

  const buildHref = (nextStatus: string, nextGame: string) => {
    const query = new URLSearchParams();
    if (nextStatus !== 'alle') query.set('status', nextStatus);
    if (nextGame !== 'alle') query.set('spiel', nextGame);
    const suffix = query.toString();
    return suffix ? `/turniere?${suffix}` : '/turniere';
  };

  const discordUrl = safeUrl(settings.discordInviteUrl);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Start', path: '/' }, { name: 'Turniere', path: '/turniere' }])} />

      <PageHero
        eyebrow="Turniere & Events"
        icon="tournament"
        ghost="Esports"
        title="Turniere der Schweizer Gaming-Community"
        lead="SwissHub organisiert regelmässig Turniere in verschiedenen Spielen – vom lockeren Community-Cup bis zum grösseren Wettbewerb. Alle Ausschreibungen, laufenden Turniere und das vollständige Archiv findest du hier."
        signals={
          running > 0
            ? [{ label: 'Aktuell', value: running === 1 ? '1 Turnier läuft' : `${running} Turniere laufen`, live: true }]
            : undefined
        }
      />

      <div className="shell section">
        <div className="mb-9 space-y-4">
          <nav aria-label="Nach Status filtern" {...revealProps('up', 0)}>
            <ul className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <li key={filter.key}>
                  <FilterLink href={buildHref(filter.key, gameFilter)} active={filter.key === statusFilter}>
                    {filter.label}
                  </FilterLink>
                </li>
              ))}
            </ul>
          </nav>

          {games.length > 0 ? (
            <nav aria-label="Nach Spiel filtern" {...revealProps('up', 1)}>
              <ul className="flex flex-wrap gap-2">
                <li>
                  <FilterLink href={buildHref(statusFilter, 'alle')} active={gameFilter === 'alle'} variant="tech">
                    Alle Spiele
                  </FilterLink>
                </li>
                {games.map((game) => (
                  <li key={game.slug}>
                    <FilterLink
                      href={buildHref(statusFilter, game.slug)}
                      active={gameFilter === game.slug}
                      variant="tech"
                    >
                      {game.shortName ?? game.name}
                    </FilterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>

        <p className="meta mb-7" role="status">
          {sorted.length === 1 ? '1 Turnier gefunden' : `${sorted.length} Turniere gefunden`}
        </p>

        {sorted.length === 0 ? (
          <EmptyState
            icon="tournament"
            title={all.length === 0 ? 'Noch keine Turniere veröffentlicht' : 'Keine Turniere für diese Auswahl'}
            description={
              all.length === 0
                ? 'Sobald ein Turnier ausgeschrieben ist, findest du hier alle Details. Ankündigungen laufen zuerst über unseren Discord.'
                : 'Passe die Filter an oder sieh dir alle Turniere an.'
            }
            action={
              all.length === 0 && discordUrl
                ? { href: discordUrl, label: 'Discord beitreten', external: true }
                : { href: '/turniere', label: 'Alle Turniere anzeigen' }
            }
          />
        ) : (
          <div className="space-y-5">
            {/* Das relevanteste Turnier bekommt deutlich mehr Gewicht. */}
            {highlight ? (
              <div {...revealProps('scale', 0)}>
                <TournamentCard tournament={highlight} featured priority />
              </div>
            ) : null}

            {rest.length > 0 ? (
              <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((tournament, index) => (
                  <li key={tournament.id} {...revealProps('up', index + 1)}>
                    <TournamentCard tournament={tournament} priority={index < 2} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
