import Link from 'next/link';
import { TournamentStatus } from '@prisma/client';
import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { formatCountdown, formatDateRange, toIsoString } from '@/lib/format';

/**
 * Turnierkarte.
 *
 * Die Darstellung richtet sich nach dem Zustand des Turniers: geplant, laufend
 * oder abgeschlossen. Angezeigt werden ausschliesslich gepflegte Angaben –
 * fehlt ein Banner, tritt eine technische Fläche an seine Stelle statt eines
 * fremden Spiel-Artworks.
 */

/** Statuswerte in verständlicher Sprache plus passende visuelle Auszeichnung. */
export const TOURNAMENT_STATUS_META: Record<
  TournamentStatus,
  { label: string; badge: string; publiclyVisible: boolean; accent: string }
> = {
  DRAFT: { label: 'Entwurf', badge: 'badge-neutral', publiclyVisible: false, accent: 'var(--color-line-strong)' },
  ANNOUNCED: { label: 'Angekündigt', badge: 'badge-info', publiclyVisible: true, accent: 'var(--color-info)' },
  REGISTRATION_OPEN: {
    label: 'Anmeldung offen',
    badge: 'badge-success',
    publiclyVisible: true,
    accent: 'var(--color-success)',
  },
  REGISTRATION_CLOSED: {
    label: 'Anmeldung geschlossen',
    badge: 'badge-warning',
    publiclyVisible: true,
    accent: 'var(--color-warning)',
  },
  RUNNING: { label: 'Läuft', badge: 'badge-brand', publiclyVisible: true, accent: 'var(--color-brand-bright)' },
  COMPLETED: { label: 'Abgeschlossen', badge: 'badge-neutral', publiclyVisible: true, accent: 'var(--color-line-strong)' },
  CANCELLED: { label: 'Abgesagt', badge: 'badge-danger', publiclyVisible: true, accent: 'var(--color-danger)' },
  ARCHIVED: { label: 'Archiviert', badge: 'badge-neutral', publiclyVisible: false, accent: 'var(--color-line-strong)' },
};

const PAST: TournamentStatus[] = [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED];

type TournamentCardProps = {
  tournament: {
    slug: string;
    title: string;
    status: TournamentStatus;
    summary: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    winnerName: string | null;
    banner: { storageKey: string; alt: string | null; width: number | null; height: number | null } | null;
    game: { name: string; shortName: string | null } | null;
  };
  priority?: boolean;
  /**
   * Grosse Darstellung für das wichtigste Turnier: quer über die volle Breite,
   * mit deutlich mehr Gewicht für Banner, Status und Anmeldung.
   */
  featured?: boolean;
};

export function TournamentCard({ tournament, priority = false, featured = false }: TournamentCardProps) {
  if (featured) return <FeaturedTournamentCard tournament={tournament} priority={priority} />;

  return <CompactTournamentCard tournament={tournament} priority={priority} />;
}

function CompactTournamentCard({ tournament, priority = false }: TournamentCardProps) {
  const status = TOURNAMENT_STATUS_META[tournament.status];
  const isPast = PAST.includes(tournament.status);
  const isRunning = tournament.status === TournamentStatus.RUNNING;
  const isOpen = tournament.status === TournamentStatus.REGISTRATION_OPEN;

  // Nur bei einem echten, in der Zukunft liegenden Termin.
  const countdown = isPast || isRunning ? null : formatCountdown(tournament.startsAt);

  return (
    <article
      data-spotlight
      className="card-interactive spotlight tilt group relative flex h-full flex-col overflow-hidden"
    >
      {/* Statusleiste: fährt beim Überfahren durch. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-[3px] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: status.accent }}
      />
      <span
        aria-hidden="true"
        className="accent-line absolute inset-x-0 top-0 z-10 h-[3px]"
        style={{ backgroundColor: 'var(--color-brand-bright)' }}
      />

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-void)]">
        {tournament.banner ? (
          <MediaImage
            storageKey={tournament.banner.storageKey}
            alt={tournament.banner.alt ?? ''}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
            className={`object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04] ${
              isPast ? 'opacity-80' : ''
            }`}
          />
        ) : (
          // Kein fremdes Spiel-Artwork: eigene technische Fläche mit Raster.
          <div className="relative flex h-full items-center justify-center">
            <span aria-hidden="true" className="absolute inset-0 tech-grid-fine opacity-70" />
            <span
              aria-hidden="true"
              className="glow-orb glow-brand left-[calc(50%-6rem)] top-[calc(50%-6rem)] h-48 w-48 opacity-25"
            />
            <Icons.tournament size={38} className="relative text-[var(--color-line-strong)]" />
          </div>
        )}

        {/* Abdunklung, damit die Badges immer lesbar bleiben. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-[color-mix(in_srgb,var(--color-void)_55%,transparent)]"
        />

        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <span className={status.badge}>
            {isRunning ? <span className="pulse-dot h-1.5 w-1.5" /> : null}
            {status.label}
          </span>
          {tournament.game ? (
            <span className="badge-tech">{tournament.game.shortName ?? tournament.game.name}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold leading-snug text-[var(--color-ink)]">
          <Link href={`/turniere/${tournament.slug}`} className="card-link">
            {tournament.title}
          </Link>
        </h3>

        {tournament.summary ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {tournament.summary}
          </p>
        ) : null}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
            <dt className="sr-only">Zeitraum</dt>
            <Icons.calendar size={15} className="shrink-0 text-[var(--color-ink-subtle)]" />
            <dd className="numeric">
              {tournament.startsAt ? (
                <time dateTime={toIsoString(tournament.startsAt)}>
                  {formatDateRange(tournament.startsAt, tournament.endsAt)}
                </time>
              ) : (
                formatDateRange(tournament.startsAt, tournament.endsAt)
              )}
            </dd>
          </div>

          {countdown ? (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Start</dt>
              <Icons.play size={15} className="shrink-0 text-[var(--color-brand-text)]" />
              <dd className="font-semibold text-[var(--color-brand-text)]">{countdown}</dd>
            </div>
          ) : null}

          {tournament.winnerName ? (
            <div className="flex items-center gap-2 text-[var(--color-ink)]">
              <dt className="sr-only">Siegerin oder Sieger</dt>
              <Icons.star size={15} className="shrink-0 text-[var(--color-warning-text)]" />
              <dd className="font-semibold">{tournament.winnerName}</dd>
            </div>
          ) : null}
        </dl>

        <p aria-hidden="true" className="link-arrow card-shift pointer-events-none mt-auto pt-5">
          {isOpen ? 'Zur Anmeldung' : isPast ? 'Rückblick ansehen' : 'Details ansehen'}
          <Icons.arrowRight size={15} />
        </p>
      </div>
    </article>
  );
}

/**
 * Grosse Variante für das wichtigste Turnier: quer über die volle Breite mit
 * Banner, Statusleiste, Eckdaten und klarer Handlungsaufforderung.
 */
function FeaturedTournamentCard({ tournament, priority = false }: TournamentCardProps) {
  const status = TOURNAMENT_STATUS_META[tournament.status];
  const isPast = PAST.includes(tournament.status);
  const isRunning = tournament.status === TournamentStatus.RUNNING;
  const isOpen = tournament.status === TournamentStatus.REGISTRATION_OPEN;
  const countdown = isPast || isRunning ? null : formatCountdown(tournament.startsAt);

  return (
    <article
      data-spotlight
      className="card-interactive spotlight group relative grid overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1 opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: status.accent }}
      />
      <span
        aria-hidden="true"
        className="accent-line absolute inset-x-0 top-0 z-10 h-1 bg-[var(--color-brand-bright)]"
      />

      {/* Banner */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-void)] lg:aspect-auto lg:min-h-[22rem]">
        {tournament.banner ? (
          <MediaImage
            storageKey={tournament.banner.storageKey}
            alt={tournament.banner.alt ?? ''}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 640px, 96vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.06]"
          />
        ) : (
          <div className="relative flex h-full items-center justify-center">
            <span aria-hidden="true" className="absolute inset-0 tech-grid opacity-70" />
            <span
              aria-hidden="true"
              data-ambient
              className="glow-orb glow-brand drift-slow left-[calc(50%-9rem)] top-[calc(50%-9rem)] h-72 w-72 opacity-35"
            />
            <Icons.tournament size={56} className="relative text-[var(--color-line-strong)]" />
          </div>
        )}

        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-[color-mix(in_srgb,var(--color-void)_45%,transparent)] lg:bg-gradient-to-r"
        />

        <div className="absolute inset-x-4 top-4 flex flex-wrap items-start gap-2">
          <span className={status.badge}>
            {isRunning ? <span className="pulse-dot h-1.5 w-1.5" /> : null}
            {status.label}
          </span>
          {tournament.game ? (
            <span className="badge-tech">{tournament.game.shortName ?? tournament.game.name}</span>
          ) : null}
        </div>
      </div>

      {/* Inhalt */}
      <div className="relative flex flex-col justify-center p-6 sm:p-9">
        <p className="meta-brand mb-3">Im Fokus</p>

        <h3 className="display-2 text-[var(--color-ink)]">
          <Link href={`/turniere/${tournament.slug}`} className="card-link">
            {tournament.title}
          </Link>
        </h3>

        {tournament.summary ? (
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-[var(--color-ink-muted)]">
            {tournament.summary}
          </p>
        ) : null}

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-t border-[var(--color-line)] pt-5">
          <div>
            <dt className="meta">Zeitraum</dt>
            <dd className="numeric mt-1 text-sm font-semibold text-[var(--color-ink)]">
              {tournament.startsAt ? (
                <time dateTime={toIsoString(tournament.startsAt)}>
                  {formatDateRange(tournament.startsAt, tournament.endsAt)}
                </time>
              ) : (
                formatDateRange(tournament.startsAt, tournament.endsAt)
              )}
            </dd>
          </div>

          {countdown ? (
            <div>
              <dt className="meta">Start</dt>
              <dd className="mt-1 text-sm font-semibold text-[var(--color-brand-text)]">{countdown}</dd>
            </div>
          ) : null}

          {tournament.winnerName ? (
            <div>
              <dt className="meta">Sieg</dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]">
                <Icons.star size={14} className="text-[var(--color-warning-text)]" />
                {tournament.winnerName}
              </dd>
            </div>
          ) : null}
        </dl>

        <p aria-hidden="true" className="link-arrow card-shift pointer-events-none mt-7 text-base">
          {isOpen ? 'Jetzt anmelden' : isPast ? 'Rückblick ansehen' : 'Details ansehen'}
          <Icons.arrowRight size={17} />
        </p>
      </div>
    </article>
  );
}
