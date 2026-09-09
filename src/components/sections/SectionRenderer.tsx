import Link from 'next/link';
import { headers } from 'next/headers';
import { LogoMark } from '@/components/brand/Logo';
import { Icons, type IconName } from '@/components/ui/Icon';
import { MediaImage } from '@/components/site/MediaImage';
import { LazyEmbed } from '@/components/site/LazyEmbed';
import { TournamentCard } from '@/components/site/TournamentCard';
import { SponsorCard, SponsorLogo } from '@/components/site/SponsorCard';
import { SocialPostCard } from '@/components/site/SocialPostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { RenderableSection, SectionLink } from '@/lib/content/sections';
import { renderRichText, safeUrl } from '@/lib/sanitize';
import { resolveEmbed } from '@/lib/content/embeds';
import { publishedStats, getSettings, type SiteSettings } from '@/lib/settings';
import {
  getAllPublicTournaments,
  getFeaturedTournaments,
  getPastTournaments,
  getRunningTournaments,
  getSocialPosts,
  getSponsors,
  getSponsorsByIds,
  getTeamMembers,
  getUpcomingTournaments,
} from '@/lib/content/queries';
import { prisma } from '@/lib/db';

/**
 * Rendert die im Website-Builder zusammengestellten Abschnitte.
 *
 * Jeder Block ist ein Server Component. Dynamische Blöcke (Turniere,
 * Sponsoren, Social) lesen ihre Daten über den getaggten Cache, damit sie stets
 * aktuell sind, ohne bei jedem Aufruf die Datenbank zu belasten.
 */

/**
 * Ersetzt Platzhalter durch gepflegte Einstellungen. Damit lassen sich z. B.
 * Impressumsangaben an einer Stelle pflegen und in mehreren Seiten verwenden.
 */
function applySettingsTokens(text: string, settings: SiteSettings): string {
  const tokens: Record<string, string> = {
    siteName: settings.siteName,
    motto: settings.motto,
    kontaktEmail: settings.contactEmail,
    vereinsname: settings.legalEntityName,
    adresse: settings.legalAddress,
    vertretung: settings.legalRepresentatives,
    register: settings.legalRegisterInfo,
  };

  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => tokens[key] ?? match);
}

const TONE_CLASS: Record<'default' | 'muted' | 'accent', string> = {
  default: '',
  muted: 'bg-[var(--color-surface)]',
  accent: 'bg-[var(--color-brand-soft)]',
};

/**
 * Platzhalter, der auf den in den Einstellungen gepflegten Discord-Link
 * verweist. So bleibt der Einladungslink an einer einzigen Stelle pflegbar.
 * Ist er nicht gesetzt, wird die Schaltfläche ausgelassen statt ins Leere zu führen.
 */
const DISCORD_TOKEN = '{discord}';

async function SectionLinkButton({ link, fallbackStyle }: { link: SectionLink; fallbackStyle?: SectionLink['style'] }) {
  const settings = await getSettings();
  const rawHref = link.href === DISCORD_TOKEN ? settings.discordInviteUrl : link.href;
  const href = safeUrl(rawHref);
  if (!href) return null;

  const style = link.style ?? fallbackStyle ?? 'primary';
  const className =
    style === 'primary' ? 'btn-primary' : style === 'secondary' ? 'btn-secondary' : 'btn-ghost';
  const external = link.external || /^https?:\/\//i.test(href);
  const isDiscord = /discord\.(gg|com)/i.test(href);

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...(isDiscord ? { 'data-track-social': 'DISCORD' } : {})}
      >
        {isDiscord ? <Icons.discord size={17} /> : null}
        {link.label}
        {!isDiscord ? <Icons.external size={13} /> : null}
        <span className="sr-only">(öffnet in neuem Tab)</span>
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {link.label}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  headline,
  intro,
  align = 'left',
}: {
  eyebrow?: string;
  headline?: string;
  intro?: string;
  align?: 'left' | 'center';
}) {
  if (!eyebrow && !headline && !intro) return null;

  return (
    <div className={`mb-8 max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? (
        <p className={`eyebrow ${align === 'center' ? 'justify-center' : ''}`}>
          <span className="h-px w-6 bg-[var(--color-brand)]" aria-hidden="true" />
          {eyebrow}
        </p>
      ) : null}
      {headline ? <h2 className="heading-lg">{headline}</h2> : null}
      {intro ? <p className="lead mt-3">{intro}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Einzelne Blöcke
// ---------------------------------------------------------------------------

async function HeroSection({ data }: { data: Extract<RenderableSection, { type: 'HERO' }>['data'] }) {
  const background = data.backgroundMediaId ? await loadMedia(data.backgroundMediaId) : null;

  return (
    <section className="relative overflow-hidden hero-veil">
      {background ? (
        <div className="absolute inset-0" aria-hidden="true">
          <MediaImage
            storageKey={background.storageKey}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-canvas)]/60 via-[var(--color-canvas)]/70 to-[var(--color-canvas)]" />
        </div>
      ) : null}

      <div className="shell relative py-16 sm:py-24 lg:py-28">
        <div className="max-w-3xl">
          {data.showLogo ? (
            <div className="mb-7">
              <LogoMark size={68} priority />
            </div>
          ) : null}

          {data.eyebrow ? (
            <p className="eyebrow">
              <Icons.swiss size={14} />
              {data.eyebrow}
            </p>
          ) : null}

          <h1 className="heading-xl">{data.headline}</h1>

          {data.motto ? (
            <p className="mt-4 text-lg font-semibold text-[var(--color-brand-text)] sm:text-xl">
              «{data.motto}»
            </p>
          ) : null}

          {data.text ? <p className="lead mt-5 max-w-2xl">{data.text}</p> : null}

          {data.primaryLink || data.secondaryLink ? (
            <div className="mt-8 flex flex-wrap gap-3">
              {data.primaryLink ? <SectionLinkButton link={data.primaryLink} /> : null}
              {data.secondaryLink ? (
                <SectionLinkButton link={data.secondaryLink} fallbackStyle="secondary" />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

async function TextSection({ data }: { data: Extract<RenderableSection, { type: 'TEXT' }>['data'] }) {
  const settings = await getSettings();
  const body = applySettingsTokens(data.text, settings);

  return (
    <section className={`section ${TONE_CLASS[data.tone]}`}>
      <div className="shell">
        <div className={`max-w-3xl ${data.align === 'center' ? 'mx-auto text-center' : ''}`}>
          {data.eyebrow ? <p className={`eyebrow ${data.align === 'center' ? 'justify-center' : ''}`}>{data.eyebrow}</p> : null}
          {data.headline ? <h2 className="heading-lg mb-4">{data.headline}</h2> : null}
          {body
            ? body
                .split(/\n{2,}/)
                .map((paragraph, index) => (
                  <p key={index} className="lead mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))
            : null}
        </div>
      </div>
    </section>
  );
}

async function RichTextSection({ data }: { data: Extract<RenderableSection, { type: 'RICH_TEXT' }>['data'] }) {
  const settings = await getSettings();
  const html = renderRichText(applySettingsTokens(data.markdown, settings));
  if (!html && !data.headline) return null;

  return (
    <section className={`section ${TONE_CLASS[data.tone]}`}>
      <div className="shell">
        <div className="max-w-3xl">
          {data.headline ? <h2 className="heading-lg mb-5">{data.headline}</h2> : null}
          {/* Das HTML entsteht serverseitig aus Markdown und ist streng gefiltert. */}
          <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}

async function ImageSection({ data }: { data: Extract<RenderableSection, { type: 'IMAGE' }>['data'] }) {
  const media = data.mediaId ? await loadMedia(data.mediaId) : null;
  if (!media) return null;

  return (
    <section className="section-tight">
      <div className={data.width === 'wide' ? 'shell' : 'shell-narrow'}>
        <figure>
          <MediaImage
            storageKey={media.storageKey}
            alt={media.alt ?? ''}
            width={media.width}
            height={media.height}
            sizes={data.width === 'wide' ? '(min-width: 1152px) 1088px, 92vw' : '(min-width: 768px) 736px, 92vw'}
            className={`h-auto w-full ${data.rounded ? 'rounded-[var(--radius-card)]' : ''} border border-[var(--color-line)]`}
          />
          {data.caption ? (
            <figcaption className="mt-3 text-sm text-[var(--color-ink-subtle)]">{data.caption}</figcaption>
          ) : null}
        </figure>
      </div>
    </section>
  );
}

async function GallerySection({ data }: { data: Extract<RenderableSection, { type: 'GALLERY' }>['data'] }) {
  const media = await loadMediaMany(data.items.map((item) => item.mediaId));
  if (media.length === 0) return null;

  const columnClass =
    data.columns === 2 ? 'sm:grid-cols-2' : data.columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} />
        <ul className={`grid grid-cols-1 gap-4 ${columnClass}`}>
          {data.items.map((item, index) => {
            const asset = media.find((entry) => entry.id === item.mediaId);
            if (!asset) return null;

            return (
              <li key={`${item.mediaId}-${index}`}>
                <figure>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
                    <MediaImage
                      storageKey={asset.storageKey}
                      alt={asset.alt ?? item.caption ?? ''}
                      fill
                      sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
                      className="object-cover"
                    />
                  </div>
                  {item.caption ? (
                    <figcaption className="mt-2 text-xs text-[var(--color-ink-subtle)]">{item.caption}</figcaption>
                  ) : null}
                </figure>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

async function VideoSection({ data }: { data: Extract<RenderableSection, { type: 'VIDEO' }>['data'] }) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost';
  const embed = resolveEmbed(data.url, host.split(':')[0]);
  if (!embed) return null;

  const poster = data.posterMediaId ? await loadMedia(data.posterMediaId) : null;

  return (
    <section className="section">
      <div className="shell-narrow">
        <SectionHeading headline={data.headline} intro={data.description} />

        {embed.kind === 'link' ? (
          <a href={embed.externalUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Video ansehen
            <Icons.external size={13} />
          </a>
        ) : (
          <LazyEmbed
            provider={embed.kind}
            embedUrl={embed.embedUrl}
            externalUrl={embed.externalUrl}
            title={data.headline || 'Video'}
            poster={
              poster ? (
                <MediaImage
                  storageKey={poster.storageKey}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 736px, 92vw"
                  className="object-cover"
                />
              ) : undefined
            }
          />
        )}
      </div>
    </section>
  );
}

function CtaSection({ data }: { data: Extract<RenderableSection, { type: 'CTA' }>['data'] }) {
  return (
    <section className="section">
      <div className="shell">
        <div
          className={`rounded-[var(--radius-card)] border p-8 text-center sm:p-12 ${
            data.tone === 'accent'
              ? 'border-[color-mix(in_srgb,var(--color-brand)_55%,transparent)] bg-[var(--color-brand-soft)]'
              : 'border-[var(--color-line)] bg-[var(--color-surface)]'
          }`}
        >
          <h2 className="heading-lg">{data.headline}</h2>
          {data.text ? <p className="lead mx-auto mt-3 max-w-xl">{data.text}</p> : null}
          {data.primaryLink || data.secondaryLink ? (
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {data.primaryLink ? <SectionLinkButton link={data.primaryLink} /> : null}
              {data.secondaryLink ? <SectionLinkButton link={data.secondaryLink} fallbackStyle="secondary" /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CardGridSection({ data }: { data: Extract<RenderableSection, { type: 'CARD_GRID' }>['data'] }) {
  if (data.cards.length === 0) return null;

  const columnClass =
    data.columns === 2 ? 'sm:grid-cols-2' : data.columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading eyebrow={data.eyebrow} headline={data.headline} intro={data.intro} />
        <ul className={`grid grid-cols-1 gap-4 ${columnClass}`}>
          {data.cards.map((card, index) => {
            const CardIcon = Icons[card.icon as IconName] ?? Icons.community;
            const href = card.link ? safeUrl(card.link.href) : null;

            return (
              <li key={index} className="card relative flex h-full flex-col p-5">
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]">
                  <CardIcon size={20} />
                </span>
                <h3 className="text-base font-semibold text-[var(--color-ink)]">
                  {href ? (
                    <Link href={href} className="after:absolute after:inset-0">
                      {card.title}
                    </Link>
                  ) : (
                    card.title
                  )}
                </h3>
                {card.text ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{card.text}</p>
                ) : null}
                {href && card.link ? (
                  <p className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-[var(--color-brand-text)]">
                    {card.link.label}
                    <Icons.arrowRight size={15} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

async function StatsSection({ data }: { data: Extract<RenderableSection, { type: 'STATS' }>['data'] }) {
  let items = data.items;

  if (data.useCommunityStats) {
    const settings = await getSettings();
    items = publishedStats(settings).map((stat) => ({
      value: stat.value,
      label: stat.label,
      description: stat.description ?? '',
    }));
  }

  // Ohne gepflegte Zahlen wird der Block auf der Website ausgelassen –
  // es werden bewusst keine erfundenen Werte angezeigt.
  if (items.length === 0) return null;

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} align="center" />
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((item, index) => (
            <div key={index} className="card p-5 text-center">
              <dt className="sr-only">{item.label}</dt>
              <dd>
                <span className="block text-2xl font-bold text-[var(--color-brand-text)] sm:text-3xl">
                  {item.value}
                </span>
                <span className="mt-1.5 block text-sm font-medium text-[var(--color-ink)]">{item.label}</span>
                {item.description ? (
                  <span className="mt-1 block text-xs text-[var(--color-ink-subtle)]">{item.description}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FaqSection({ data }: { data: Extract<RenderableSection, { type: 'FAQ' }>['data'] }) {
  if (data.items.length === 0) return null;

  return (
    <section className="section">
      <div className="shell-narrow">
        <SectionHeading headline={data.headline} intro={data.intro} />
        <div className="space-y-3">
          {data.items.map((item, index) => (
            /* <details> funktioniert ohne JavaScript und ist von Haus aus zugänglich. */
            <details key={index} className="card group px-5 py-4 [&[open]>summary>svg]:rotate-45">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[var(--color-ink)]">
                {item.question}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-brand-text)] transition-transform duration-200"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <div className="prose-swisshub mt-3" dangerouslySetInnerHTML={{ __html: renderRichText(item.answer) }} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

async function LogoBarSection({ data }: { data: Extract<RenderableSection, { type: 'LOGO_BAR' }>['data'] }) {
  const sponsors = data.sponsorIds.length > 0 ? await getSponsorsByIds(data.sponsorIds) : await getSponsors('ACTIVE', 12);
  if (sponsors.length === 0) return null;

  const settings = await getSettings();

  return (
    <section className="section-tight border-y border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="shell">
        {data.showTitle ? (
          <h2 className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">
            {data.headline || settings.sponsorSectionLabel}
          </h2>
        ) : null}
        <ul className="flex flex-wrap items-center justify-center gap-4">
          {sponsors.map((sponsor) => {
            const website = safeUrl(sponsor.websiteUrl);
            const content = <SponsorLogo sponsor={sponsor} className="opacity-80 transition-opacity hover:opacity-100" />;

            return (
              <li key={sponsor.id} className="logo-plate min-w-[140px]">
                {website ? (
                  <a href={website} target="_blank" rel="noopener noreferrer sponsored" data-track-sponsor={sponsor.slug}>
                    {content}
                    <span className="sr-only">{sponsor.name} (öffnet in neuem Tab)</span>
                  </a>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

async function SocialHighlightsSection({
  data,
}: {
  data: Extract<RenderableSection, { type: 'SOCIAL_HIGHLIGHTS' }>['data'];
}) {
  const posts = await getSocialPosts({
    platforms: data.platforms.length > 0 ? data.platforms : undefined,
    onlyFeatured: data.onlyFeatured,
    limit: data.limit,
  });

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} intro={data.intro} />
        {posts.length === 0 ? (
          <EmptyState
            title="Noch keine Beiträge freigegeben"
            description="Sobald wir Beiträge kuratieren, erscheinen sie hier. Aktuelles findest du jederzeit auf unseren Kanälen."
            action={{ href: '/social', label: 'Zu unseren Kanälen' }}
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
      </div>
    </section>
  );
}

async function TournamentListSection({
  data,
}: {
  data: Extract<RenderableSection, { type: 'TOURNAMENT_LIST' }>['data'];
}) {
  const tournaments =
    data.filter === 'featured'
      ? await getFeaturedTournaments(data.limit)
      : data.filter === 'past'
        ? await getPastTournaments(data.limit)
        : data.filter === 'running'
          ? await getRunningTournaments(data.limit)
          : data.filter === 'all'
            ? (await getAllPublicTournaments()).slice(0, data.limit)
            : await getUpcomingTournaments(data.limit);

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} intro={data.intro} />

        {tournaments.length === 0 ? (
          <EmptyState
            title="Aktuell sind keine Turniere ausgeschrieben"
            description="Neue Turniere kündigen wir zuerst auf unserem Discord an. Schau im Archiv, was bisher gespielt wurde."
            action={{ href: '/turniere', label: 'Turnierarchiv ansehen' }}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament) => (
              <li key={tournament.id}>
                <TournamentCard tournament={tournament} />
              </li>
            ))}
          </ul>
        )}

        {data.showLinkToOverview && tournaments.length > 0 ? (
          <p className="mt-8">
            <Link href="/turniere" className="btn-secondary">
              Alle Turniere ansehen
              <Icons.arrowRight size={15} />
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

async function SponsorListSection({ data }: { data: Extract<RenderableSection, { type: 'SPONSOR_LIST' }>['data'] }) {
  const sponsors = await getSponsors(data.status === 'ALL' ? 'ALL' : data.status, data.limit);

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} intro={data.intro} />
        {sponsors.length === 0 ? (
          <EmptyState
            title="Noch keine Partner veröffentlicht"
            description="Du möchtest SwissHub unterstützen? Wir freuen uns über deine Anfrage."
            action={{ href: '/kontakt?kategorie=sponsoring', label: 'Sponsoring anfragen' }}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((sponsor) => (
              <li key={sponsor.id}>
                <SponsorCard sponsor={sponsor} showDescription={data.showDescription} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

async function TeamMembersSection({ data }: { data: Extract<RenderableSection, { type: 'TEAM_MEMBERS' }>['data'] }) {
  const members = await getTeamMembers(data.limit);
  if (members.length === 0) return null;

  return (
    <section className="section">
      <div className="shell">
        <SectionHeading headline={data.headline} intro={data.intro} />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member) => (
            <li key={member.id} className="card p-5 text-center">
              <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
                {member.avatar ? (
                  <MediaImage
                    storageKey={member.avatar.storageKey}
                    alt={member.avatar.alt ?? member.name}
                    width={160}
                    height={160}
                    sizes="80px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-xl font-bold text-[var(--color-ink-subtle)]">
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-[var(--color-ink)]">{member.name}</h3>
              <p className="mt-0.5 text-sm text-[var(--color-brand-text)]">{member.role}</p>
              {member.description ? (
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{member.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SpacerSection({ data }: { data: Extract<RenderableSection, { type: 'SPACER' }>['data'] }) {
  const height = data.size === 'small' ? 'h-6' : data.size === 'large' ? 'h-20' : 'h-12';

  if (data.showDivider) {
    return (
      <div className="shell">
        <hr className={`border-0 border-t border-[var(--color-line)] ${data.size === 'small' ? 'my-6' : data.size === 'large' ? 'my-20' : 'my-12'}`} />
      </div>
    );
  }

  return <div className={height} aria-hidden="true" />;
}

async function TwoColumnSection({ data }: { data: Extract<RenderableSection, { type: 'TWO_COLUMN' }>['data'] }) {
  const ratioClass =
    data.ratio === '60-40'
      ? 'lg:grid-cols-[3fr_2fr]'
      : data.ratio === '40-60'
        ? 'lg:grid-cols-[2fr_3fr]'
        : 'lg:grid-cols-2';

  const [left, right] = await Promise.all([renderColumn(data.left), renderColumn(data.right)]);

  return (
    <section className={`section ${TONE_CLASS[data.tone]}`}>
      <div className="shell">
        <SectionHeading eyebrow={data.eyebrow} headline={data.headline} />
        <div className={`grid grid-cols-1 gap-8 ${ratioClass} ${data.verticalAlign === 'center' ? 'lg:items-center' : 'lg:items-start'}`}>
          {left}
          {right}
        </div>
      </div>
    </section>
  );
}

async function renderColumn(column: Extract<RenderableSection, { type: 'TWO_COLUMN' }>['data']['left']) {
  if (column.kind === 'image') {
    const media = column.mediaId ? await loadMedia(column.mediaId) : null;
    if (!media) return <div />;

    return (
      <div>
        {column.headline ? <h3 className="heading-md mb-4">{column.headline}</h3> : null}
        <MediaImage
          storageKey={media.storageKey}
          alt={media.alt ?? ''}
          width={media.width}
          height={media.height}
          sizes="(min-width: 1024px) 540px, 92vw"
          className="h-auto w-full rounded-[var(--radius-card)] border border-[var(--color-line)]"
        />
      </div>
    );
  }

  if (column.kind === 'links') {
    return (
      <div>
        {column.headline ? <h3 className="heading-md mb-4">{column.headline}</h3> : null}
        <ul className="flex flex-wrap gap-3">
          {column.links.map((link, index) => (
            <li key={index}>
              <SectionLinkButton link={link} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {column.headline ? <h3 className="heading-md mb-4">{column.headline}</h3> : null}
      <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: renderRichText(column.markdown) }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medienauflösung
// ---------------------------------------------------------------------------

type MediaRecord = { id: string; storageKey: string; alt: string | null; width: number | null; height: number | null };

async function loadMedia(id: string): Promise<MediaRecord | null> {
  if (!id) return null;
  return prisma.mediaAsset.findUnique({
    where: { id },
    select: { id: true, storageKey: true, alt: true, width: true, height: true },
  });
}

async function loadMediaMany(ids: string[]): Promise<MediaRecord[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  return prisma.mediaAsset.findMany({
    where: { id: { in: unique } },
    select: { id: true, storageKey: true, alt: true, width: true, height: true },
  });
}

// ---------------------------------------------------------------------------
// Verteiler
// ---------------------------------------------------------------------------

export async function SectionRenderer({ sections }: { sections: RenderableSection[] }) {
  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <RenderSection key={section.id} section={section} />
        ))}
    </>
  );
}

async function RenderSection({ section }: { section: RenderableSection }) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection data={section.data} />;
    case 'TEXT':
      return <TextSection data={section.data} />;
    case 'RICH_TEXT':
      return <RichTextSection data={section.data} />;
    case 'IMAGE':
      return <ImageSection data={section.data} />;
    case 'GALLERY':
      return <GallerySection data={section.data} />;
    case 'VIDEO':
      return <VideoSection data={section.data} />;
    case 'CTA':
      return <CtaSection data={section.data} />;
    case 'CARD_GRID':
      return <CardGridSection data={section.data} />;
    case 'STATS':
      return <StatsSection data={section.data} />;
    case 'FAQ':
      return <FaqSection data={section.data} />;
    case 'LOGO_BAR':
      return <LogoBarSection data={section.data} />;
    case 'SOCIAL_HIGHLIGHTS':
      return <SocialHighlightsSection data={section.data} />;
    case 'TOURNAMENT_LIST':
      return <TournamentListSection data={section.data} />;
    case 'SPONSOR_LIST':
      return <SponsorListSection data={section.data} />;
    case 'TEAM_MEMBERS':
      return <TeamMembersSection data={section.data} />;
    case 'SPACER':
      return <SpacerSection data={section.data} />;
    case 'TWO_COLUMN':
      return <TwoColumnSection data={section.data} />;
    default:
      return null;
  }
}
