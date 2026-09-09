import type { SocialPlatform, SocialPostType } from '@prisma/client';
import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { SOCIAL_PLATFORM_META, SOCIAL_POST_TYPE_LABEL } from '@/components/site/socialMeta';
import { formatDate, toIsoString } from '@/lib/format';
import { safeUrl } from '@/lib/sanitize';

/**
 * Kuratierter Social-Media-Beitrag.
 *
 * Es wird kein Embed der Plattform geladen: angezeigt werden nur die im
 * Dashboard gepflegten Angaben und ein lokal gespeichertes Vorschaubild. Das
 * hält die Seite schnell und überträgt keine Daten an Dritte.
 *
 * Highlights erhalten sichtbar mehr Gewicht, damit der Stream nicht wie ein
 * gleichförmiges Kartenraster wirkt.
 */

type SocialPost = {
  id: string;
  platform: SocialPlatform;
  type: SocialPostType;
  title: string;
  excerpt: string | null;
  url: string;
  postedAt: Date | null;
  featured: boolean;
  thumbnail: { storageKey: string; alt: string | null; width: number | null; height: number | null } | null;
  account?: { handle: string } | null;
};

export function SocialPostCard({ post, emphasis = false }: { post: SocialPost; emphasis?: boolean }) {
  const meta = SOCIAL_PLATFORM_META[post.platform];
  const PlatformIcon = meta.icon;
  const url = safeUrl(post.url);
  const highlighted = emphasis || post.featured;

  return (
    <article
      className={`card-interactive group relative flex h-full flex-col overflow-hidden ${
        highlighted ? 'border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-line))]' : ''
      }`}
    >
      <span aria-hidden="true" className="accent-line absolute inset-x-0 top-0 z-10 h-px bg-[var(--color-brand-bright)]" />

      {post.thumbnail ? (
        <div className={`relative w-full overflow-hidden bg-[var(--color-void)] ${highlighted ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
          <MediaImage
            storageKey={post.thumbnail.storageKey}
            alt={post.thumbnail.alt ?? ''}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent"
          />

          {/* Videoinhalte klar als solche kennzeichnen. */}
          {post.type === 'VIDEO' || post.type === 'CLIP' || post.type === 'STREAM' ? (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--color-void)_82%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)] backdrop-blur-sm">
              <Icons.play size={12} />
              {SOCIAL_POST_TYPE_LABEL[post.type]}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="badge-tech" style={{ color: 'var(--color-ink)' }}>
            <PlatformIcon size={13} />
            {meta.label}
          </span>
          {!post.thumbnail ? <span className="badge-neutral">{SOCIAL_POST_TYPE_LABEL[post.type]}</span> : null}
          {post.featured ? <span className="badge-brand">Highlight</span> : null}
        </div>

        <h3 className={`font-semibold leading-snug text-[var(--color-ink)] ${highlighted ? 'text-lg' : 'text-base'}`}>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-track-social={post.platform}
              className="after:absolute after:inset-0"
            >
              {post.title}
            </a>
          ) : (
            post.title
          )}
        </h3>

        {post.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">{post.excerpt}</p>
        ) : null}

        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-5">
          {post.postedAt ? (
            <time className="meta" dateTime={toIsoString(post.postedAt)}>
              {formatDate(post.postedAt)}
            </time>
          ) : null}
          {post.account ? <span className="meta">· {post.account.handle}</span> : null}
          {url ? (
            <span className="link-arrow ml-auto text-xs">
              Ansehen <Icons.external size={12} />
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
