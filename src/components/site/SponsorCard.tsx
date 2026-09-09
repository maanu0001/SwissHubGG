import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { safeUrl } from '@/lib/sanitize';
import { formatDateRange } from '@/lib/format';

/**
 * Sponsorendarstellung.
 *
 * Bewusst ruhig und vertrauenswürdig gehalten: Logos werden proportional in
 * eine feste Fläche eingepasst, nie verzerrt, beschnitten, eingefärbt oder mit
 * Effekten überlagert. Bewegung beschränkt sich auf den Rahmen um das Logo.
 */

type Sponsor = {
  slug: string;
  name: string;
  status: 'ACTIVE' | 'FORMER';
  shortDescription: string | null;
  description?: string | null;
  websiteUrl: string | null;
  partnerSince: Date | null;
  partnerUntil: Date | null;
  logo: { storageKey: string; alt: string | null; width: number | null; height: number | null } | null;
  tier: { key: string; name: string } | null;
  tournaments?: { tournament: { slug: string; title: string } }[];
};

/** Minimale Form, die für die reine Logodarstellung genügt. */
type SponsorLogoInput = {
  name: string;
  logo: { storageKey: string; alt: string | null; width: number | null; height: number | null } | null;
};

export function SponsorLogo({ sponsor, className = '' }: { sponsor: SponsorLogoInput; className?: string }) {
  if (!sponsor.logo) {
    return (
      <span className={`flex items-center justify-center text-sm font-semibold text-[var(--color-ink-muted)] ${className}`}>
        {sponsor.name}
      </span>
    );
  }

  return (
    <MediaImage
      storageKey={sponsor.logo.storageKey}
      alt={sponsor.logo.alt ?? sponsor.name}
      width={sponsor.logo.width}
      height={sponsor.logo.height}
      sizes="(min-width: 640px) 200px, 45vw"
      className={`max-h-12 w-auto object-contain ${className}`}
    />
  );
}

export function SponsorCard({ sponsor, showDescription = true }: { sponsor: Sponsor; showDescription?: boolean }) {
  const website = safeUrl(sponsor.websiteUrl);
  const isFormer = sponsor.status === 'FORMER';

  return (
    <article className="card-interactive group relative flex h-full flex-col p-5 sm:p-6">
      <span aria-hidden="true" className="accent-line absolute inset-x-0 top-0 h-px bg-[var(--color-brand)]" />

      {/* Ruhige Logofläche mit konstanter Höhe – kein Springen im Raster. */}
      <div className="relative flex h-24 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] px-4">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg tech-grid-fine opacity-50" />
        <span className="relative">
          <SponsorLogo sponsor={sponsor} />
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">{sponsor.name}</h3>
        {sponsor.tier ? <span className="badge-brand">{sponsor.tier.name}</span> : null}
        {isFormer ? <span className="badge-neutral">Ehemaliger Partner</span> : null}
      </div>

      {showDescription && sponsor.shortDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{sponsor.shortDescription}</p>
      ) : null}

      {sponsor.partnerSince || sponsor.partnerUntil ? (
        <p className="meta mt-4">Partnerschaft {formatDateRange(sponsor.partnerSince, sponsor.partnerUntil)}</p>
      ) : null}

      {sponsor.tournaments && sponsor.tournaments.length > 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-subtle)]">
          Unterstützte Turniere: {sponsor.tournaments.map((entry) => entry.tournament.title).join(', ')}
        </p>
      ) : null}

      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-track-sponsor={sponsor.slug}
          className="link-arrow mt-auto pt-5 after:absolute after:inset-0"
        >
          Website besuchen
          <Icons.external size={13} />
          <span className="sr-only">(öffnet in neuem Tab)</span>
        </a>
      ) : null}
    </article>
  );
}
