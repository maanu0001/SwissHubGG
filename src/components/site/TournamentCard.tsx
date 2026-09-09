import Link from 'next/link';
import type { TournamentStatus } from '@prisma/client';
import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { formatDateRange } from '@/lib/format';

/** Statuswerte in verständlicher Sprache plus passende visuelle Auszeichnung. */
export const TOURNAMENT_STATUS_META: Record<
  TournamentStatus,
  { label: string; badge: string; publiclyVisible: boolean }
> = {
  DRAFT: { label: 'Entwurf', badge: 'badge-neutral', publiclyVisible: false },
  ANNOUNCED: { label: 'Angekündigt', badge: 'badge-info', publiclyVisible: true },
  REGISTRATION_OPEN: { label: 'Anmeldung offen', badge: 'badge-success', publiclyVisible: true },
  REGISTRATION_CLOSED: { label: 'Anmeldung geschlossen', badge: 'badge-warning', publiclyVisible: true },
  RUNNING: { label: 'Läuft', badge: 'badge-brand', publiclyVisible: true },
  COMPLETED: { label: 'Abgeschlossen', badge: 'badge-neutral', publiclyVisible: true },
  CANCELLED: { label: 'Abgesagt', badge: 'badge-danger', publiclyVisible: true },
  ARCHIVED: { label: 'Archiviert', badge: 'badge-neutral', publiclyVisible: false },
};

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
};

export function TournamentCard({ tournament, priority = false }: TournamentCardProps) {
  const status = TOURNAMENT_STATUS_META[tournament.status];

  return (
    <article className="card-interactive group relative flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-surface-raised)]">
        {tournament.banner ? (
          <MediaImage
            storageKey={tournament.banner.storageKey}
            alt={tournament.banner.alt ?? ''}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icons.tournament size={36} className="text-[var(--color-line-strong)]" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={status.badge}>{status.label}</span>
          {tournament.game ? (
            <span className="badge-neutral">{tournament.game.shortName ?? tournament.game.name}</span>
          ) : null}
        </div>

        <h3 className="text-lg font-bold leading-snug text-[var(--color-ink)]">
          <Link href={`/turniere/${tournament.slug}`} className="after:absolute after:inset-0">
            {tournament.title}
          </Link>
        </h3>

        {tournament.summary ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {tournament.summary}
          </p>
        ) : null}

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
            <dt className="sr-only">Zeitraum</dt>
            <Icons.calendar size={15} className="shrink-0 text-[var(--color-ink-subtle)]" />
            <dd>{formatDateRange(tournament.startsAt, tournament.endsAt)}</dd>
          </div>
          {tournament.winnerName ? (
            <div className="flex items-center gap-2 text-[var(--color-ink-muted)]">
              <dt className="sr-only">Siegerin oder Sieger</dt>
              <Icons.star size={15} className="shrink-0 text-[var(--color-brand-text)]" />
              <dd>{tournament.winnerName}</dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-4 flex items-center gap-1.5 pt-1 text-sm font-semibold text-[var(--color-brand-text)]">
          Details ansehen
          <Icons.arrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </p>
      </div>
    </article>
  );
}
