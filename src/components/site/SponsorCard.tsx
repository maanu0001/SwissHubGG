import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { safeUrl } from '@/lib/sanitize';
import { formatDateRange } from '@/lib/format';

/**
 * Sponsorendarstellung mit einheitlicher Logo-Behandlung: Logos werden
 * proportional in eine feste Fläche eingepasst und nie verzerrt oder
 * beschnitten.
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
    <article className="card flex h-full flex-col p-5">
      <div className="flex h-20 items-center justify-start">
        <SponsorLogo sponsor={sponsor} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">{sponsor.name}</h3>
        {sponsor.tier ? <span className="badge-brand">{sponsor.tier.name}</span> : null}
        {isFormer ? <span className="badge-neutral">Ehemaliger Partner</span> : null}
      </div>

      {showDescription && sponsor.shortDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{sponsor.shortDescription}</p>
      ) : null}

      {(sponsor.partnerSince || sponsor.partnerUntil) && (
        <p className="mt-3 text-xs text-[var(--color-ink-subtle)]">
          Partnerschaft: {formatDateRange(sponsor.partnerSince, sponsor.partnerUntil)}
        </p>
      )}

      {sponsor.tournaments && sponsor.tournaments.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--color-ink-subtle)]">
          Unterstützte Turniere: {sponsor.tournaments.map((entry) => entry.tournament.title).join(', ')}
        </p>
      ) : null}

      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-track-sponsor={sponsor.slug}
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-[var(--color-brand-text)] hover:text-[var(--color-ink)]"
        >
          Website besuchen
          <Icons.external size={13} />
          <span className="sr-only">(öffnet in neuem Tab)</span>
        </a>
      ) : null}
    </article>
  );
}
