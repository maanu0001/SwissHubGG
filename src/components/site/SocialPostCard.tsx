import type { SocialPlatform, SocialPostType } from '@prisma/client';
import { MediaImage } from '@/components/site/MediaImage';
import { Icons } from '@/components/ui/Icon';
import { SOCIAL_PLATFORM_META, SOCIAL_POST_TYPE_LABEL } from '@/components/site/socialMeta';
import { formatDate } from '@/lib/format';
import { safeUrl } from '@/lib/sanitize';

/**
 * Kuratierter Social-Media-Beitrag.
 *
 * Es wird kein Embed der Plattform geladen: angezeigt werden nur die im
 * Dashboard gepflegten Angaben und ein lokal gespeichertes Vorschaubild. Das
 * hält die Seite schnell und überträgt keine Daten an Dritte.
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

export function SocialPostCard({ post }: { post: SocialPost }) {
  const meta = SOCIAL_PLATFORM_META[post.platform];
  const PlatformIcon = meta.icon;
  const url = safeUrl(post.url);

  return (
    <article className="card-interactive group relative flex h-full flex-col overflow-hidden">
      {post.thumbnail ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--color-surface-raised)]">
          <MediaImage
            storageKey={post.thumbnail.storageKey}
            alt={post.thumbnail.alt ?? ''}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="badge-neutral">
            <PlatformIcon size={13} />
            {meta.label}
          </span>
          <span className="badge-neutral">{SOCIAL_POST_TYPE_LABEL[post.type]}</span>
          {post.featured ? <span className="badge-brand">Highlight</span> : null}
        </div>

        <h3 className="text-base font-semibold leading-snug text-[var(--color-ink)]">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" data-track-social={post.platform} className="after:absolute after:inset-0">
              {post.title}
            </a>
          ) : (
            post.title
          )}
        </h3>

        {post.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">{post.excerpt}</p>
        ) : null}

        <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-[var(--color-ink-subtle)]">
          {post.postedAt ? <span>{formatDate(post.postedAt)}</span> : null}
          {post.account ? <span>· {post.account.handle}</span> : null}
          {url ? (
            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--color-brand-text)]">
              Ansehen <Icons.external size={12} />
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}
