import type { Metadata } from 'next';
import Link from 'next/link';
import type { SocialPlatform } from '@prisma/client';
import { SocialPostCard } from '@/components/site/SocialPostCard';
import { SOCIAL_PLATFORM_META } from '@/components/site/socialMeta';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { getSocialAccounts, getSocialPosts } from '@/lib/content/queries';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { getSettings } from '@/lib/settings';
import { formatNumber } from '@/lib/format';
import { safeUrl } from '@/lib/sanitize';

/**
 * Zentrale Social-Media-Seite.
 *
 * Es werden keine Embeds der Plattformen geladen. Angezeigt werden die
 * gepflegten Accounts und kuratierte Beiträge mit lokalen Vorschaubildern –
 * schnell und ohne Datenübertragung an Dritte.
 */

type PageProps = { searchParams: Promise<{ plattform?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'SwissHub auf Discord, Instagram, TikTok, YouTube und Twitch',
    description:
      'Alle Kanäle der Schweizer Gaming-Community SwissHub auf einen Blick – Discord als zentraler Treffpunkt sowie Instagram, TikTok, YouTube und Twitch.',
    path: '/social',
  });
}

export default async function SocialPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [accounts, settings] = await Promise.all([getSocialAccounts(), getSettings()]);

  const availablePlatforms = [...new Set(accounts.map((account) => account.platform))];
  const selected =
    params.plattform && availablePlatforms.includes(params.plattform.toUpperCase() as SocialPlatform)
      ? (params.plattform.toUpperCase() as SocialPlatform)
      : null;

  const posts = await getSocialPosts({
    platforms: selected ? [selected] : undefined,
    limit: 18,
  });

  const discordUrl = safeUrl(settings.discordInviteUrl);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Start', path: '/' }, { name: 'Social Media', path: '/social' }])} />

      <section className="border-b border-[var(--color-line)] hero-veil">
        <div className="shell py-14 sm:py-20">
          <p className="eyebrow">
            <Icons.chat size={14} />
            Social Media
          </p>
          <h1 className="heading-xl max-w-2xl">Folge SwissHub</h1>
          <p className="lead mt-4 max-w-2xl">
            Der Discord ist unser zentraler Treffpunkt – dort läuft der Alltag der Community. Auf den übrigen Kanälen
            teilen wir Highlights, Clips und Ankündigungen.
          </p>
        </div>
      </section>

      <div className="shell section space-y-14">
        <section aria-labelledby="kanaele">
          <h2 id="kanaele" className="heading-lg mb-6">Unsere Kanäle</h2>

          {accounts.length === 0 ? (
            <EmptyState
              title="Noch keine Kanäle hinterlegt"
              description="Die Accounts werden im Admin-Dashboard gepflegt und erscheinen anschliessend hier."
              action={{ href: '/kontakt', label: 'Kontakt aufnehmen' }}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const meta = SOCIAL_PLATFORM_META[account.platform];
                const PlatformIcon = meta.icon;
                const url = safeUrl(account.profileUrl);

                return (
                  <li key={account.id} className="card relative flex h-full flex-col p-5">
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]">
                      <PlatformIcon size={22} />
                    </span>

                    <h3 className="text-base font-semibold text-[var(--color-ink)]">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-track-social={account.platform}
                          className="after:absolute after:inset-0"
                        >
                          {meta.label}
                        </a>
                      ) : (
                        meta.label
                      )}
                    </h3>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-subtle)]">{account.handle}</p>

                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                      {account.description || meta.description}
                    </p>

                    <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-[var(--color-ink-subtle)]">
                      {typeof account.followerCount === 'number' ? (
                        <span>{formatNumber(account.followerCount)} Follower</span>
                      ) : null}
                      {url ? (
                        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--color-brand-text)]">
                          Profil öffnen <Icons.external size={12} />
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="beitraege">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <h2 id="beitraege" className="heading-lg">Ausgewählte Beiträge</h2>

            {availablePlatforms.length > 1 ? (
              <nav aria-label="Nach Plattform filtern">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link
                      href="/social"
                      aria-current={selected === null ? 'true' : undefined}
                      className={selected === null ? 'badge border-[var(--color-line-strong)] bg-[var(--color-surface-hover)] px-3 py-1 font-semibold text-[var(--color-ink)]' : 'badge-neutral px-3 py-1'}
                    >
                      Alle
                    </Link>
                  </li>
                  {availablePlatforms.map((platform) => (
                    <li key={platform}>
                      <Link
                        href={`/social?plattform=${platform.toLowerCase()}`}
                        aria-current={selected === platform ? 'true' : undefined}
                        className={selected === platform ? 'badge border-[var(--color-line-strong)] bg-[var(--color-surface-hover)] px-3 py-1 font-semibold text-[var(--color-ink)]' : 'badge-neutral px-3 py-1'}
                      >
                        {SOCIAL_PLATFORM_META[platform].label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>

          {posts.length === 0 ? (
            <EmptyState
              title="Aktuell sind keine Beiträge freigegeben"
              description="Wir kuratieren hier ausgewählte Beiträge unserer Kanäle. Bis dahin findest du alles Aktuelle direkt auf den Profilen oder im Discord."
              action={discordUrl ? { href: discordUrl, label: 'Discord beitreten', external: true } : undefined}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <SocialPostCard post={post} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {discordUrl ? (
          <section className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-brand)_55%,transparent)] bg-[var(--color-brand-soft)] p-8 text-center sm:p-12">
            <h2 className="heading-lg">Zäme hock, zäme zocke</h2>
            <p className="lead mx-auto mt-3 max-w-xl">
              Der schnellste Weg in die Community führt über unseren Discord – dort findest du Mitspielende, Events und
              den Support.
            </p>
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track-social="DISCORD"
              className="btn-primary mt-7"
            >
              <Icons.discord size={18} />
              Discord beitreten
            </a>
          </section>
        ) : null}
      </div>
    </>
  );
}
