import type { Metadata } from 'next';
import Link from 'next/link';
import type { SocialPlatform } from '@prisma/client';
import { SocialPostCard } from '@/components/site/SocialPostCard';
import { SOCIAL_PLATFORM_META } from '@/components/site/socialMeta';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { PageHero } from '@/components/site/PageHero';
import { Reveal, revealProps } from '@/components/visual/Reveal';
import { SectionHeading } from '@/components/visual/Section';
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
 * schnell und ohne Datenübertragung an Dritte. Es gibt keinen simulierten
 * Live-Feed.
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

  const filterClass = (active: boolean) =>
    active
      ? 'badge border-[color-mix(in_srgb,var(--color-brand)_65%,transparent)] bg-[var(--color-brand)] px-4 py-2 font-semibold text-white'
      : 'badge-neutral px-4 py-2 transition-colors duration-200 hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]';

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Start', path: '/' }, { name: 'Social Media', path: '/social' }])} />

      <PageHero
        eyebrow="Social Media"
        icon="chat"
        ghost="Social"
        title="Folge SwissHub"
        lead="Der Discord ist unser zentraler Treffpunkt – dort läuft der Alltag der Community. Auf den übrigen Kanälen teilen wir Highlights, Clips und Ankündigungen."
        signals={
          accounts.length > 0
            ? [{ label: 'Kanäle', value: accounts.length === 1 ? '1 Kanal' : `${accounts.length} Kanäle` }]
            : undefined
        }
      />

      <div className="shell section space-y-16 sm:space-y-20">
        <section aria-labelledby="kanaele">
          <SectionHeading id="kanaele" index={1} eyebrow="Kanäle" headline="Wo du uns findest" />

          {accounts.length === 0 ? (
            <EmptyState
              icon="chat"
              title="Noch keine Kanäle hinterlegt"
              description="Die Accounts werden im Admin-Dashboard gepflegt und erscheinen anschliessend hier."
              action={{ href: '/kontakt', label: 'Kontakt aufnehmen' }}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account, index) => {
                const meta = SOCIAL_PLATFORM_META[account.platform];
                const PlatformIcon = meta.icon;
                const url = safeUrl(account.profileUrl);
                const isDiscord = account.platform === 'DISCORD';

                return (
                  <li key={account.id} {...revealProps('up', index)}>
                    {/* Discord bekommt als zentraler Treffpunkt sichtbar mehr Gewicht. */}
                    <article
                      className={`card-interactive group relative flex h-full flex-col p-5 sm:p-6 ${
                        isDiscord ? 'border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-line))]' : ''
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="accent-line absolute inset-x-0 top-0 h-px bg-[var(--color-brand-bright)]"
                      />

                      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--color-brand)_30%,var(--color-line))] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-y-0.5">
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
                      <p className="meta mt-1">{account.handle}</p>

                      <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                        {account.description || meta.description}
                      </p>

                      <p className="mt-auto flex items-center gap-2 pt-5">
                        {typeof account.followerCount === 'number' ? (
                          <span className="meta numeric">{formatNumber(account.followerCount)} Follower</span>
                        ) : null}
                        {url ? (
                          <span className="link-arrow ml-auto text-xs">
                            Profil öffnen <Icons.external size={12} />
                          </span>
                        ) : null}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="beitraege">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <SectionHeading
                id="beitraege"
                index={2}
                eyebrow="Kuratiert"
                headline="Ausgewählte Beiträge"
                intro="Von uns ausgewählt – ohne automatisch geladene Plattform-Feeds."
              />
            </div>

            {availablePlatforms.length > 1 ? (
              <nav aria-label="Nach Plattform filtern">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link href="/social" aria-current={selected === null ? 'true' : undefined} className={filterClass(selected === null)}>
                      Alle
                    </Link>
                  </li>
                  {availablePlatforms.map((platform) => (
                    <li key={platform}>
                      <Link
                        href={`/social?plattform=${platform.toLowerCase()}`}
                        aria-current={selected === platform ? 'true' : undefined}
                        className={filterClass(selected === platform)}
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
              icon="play"
              title="Aktuell sind keine Beiträge freigegeben"
              description="Wir kuratieren hier ausgewählte Beiträge unserer Kanäle. Bis dahin findest du alles Aktuelle direkt auf den Profilen oder im Discord."
              action={discordUrl ? { href: discordUrl, label: 'Discord beitreten', external: true } : undefined}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <li
                  key={post.id}
                  className={index === 0 ? 'sm:col-span-2' : ''}
                  {...revealProps(index % 2 === 0 ? 'up' : 'scale', index, 80)}
                >
                  <SocialPostCard post={post} emphasis={index === 0} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {discordUrl ? (
          <Reveal variant="scale">
            <section className="relative isolate overflow-hidden rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] bg-[var(--color-brand-soft)] p-8 text-center sm:p-14">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-45" />
              <span
                aria-hidden="true"
                data-ambient
                className="glow-orb glow-brand drift-slow pointer-events-none left-[calc(50%-13rem)] top-[-7rem] h-[26rem] w-[26rem] opacity-35"
              />

              <div className="relative">
                <h2 className="display-hero">{settings.motto ? `«${settings.motto}»` : 'Komm in die Community'}</h2>
                <p className="lead mx-auto mt-4 max-w-xl">
                  Der schnellste Weg in die Community führt über unseren Discord – dort findest du Mitspielende, Events
                  und den Support.
                </p>
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track-social="DISCORD"
                  className="btn-primary btn-lg mt-8"
                >
                  <Icons.discord size={18} />
                  Discord beitreten
                </a>
              </div>
            </section>
          </Reveal>
        ) : null}
      </div>
    </>
  );
}
