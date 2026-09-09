import Link from 'next/link';
import { headers } from 'next/headers';
import { LogoStage } from '@/components/brand/Logo';
import { Icons, type IconName } from '@/components/ui/Icon';
import { MediaImage } from '@/components/site/MediaImage';
import { LazyEmbed } from '@/components/site/LazyEmbed';
import { TournamentCard } from '@/components/site/TournamentCard';
import { SponsorCard, SponsorLogo } from '@/components/site/SponsorCard';
import { SocialPostCard } from '@/components/site/SocialPostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal, revealProps } from '@/components/visual/Reveal';
import { SectionHeading, SectionShell, type SectionTone } from '@/components/visual/Section';
import { AnimatedNumber } from '@/components/visual/AnimatedNumber';
import type { RenderableSection, SectionLink } from '@/lib/content/sections';
import { renderRichText, safeUrl } from '@/lib/sanitize';
import { resolveEmbed } from '@/lib/content/embeds';
import { publishedStats, getSettings, type SiteSettings } from '@/lib/settings';
import {
  getVisiblePublicTournaments,
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
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/featureFlags';

/**
 * Rendert die im Website-Builder zusammengestellten Abschnitte.
 *
 * Jeder Block ist ein Server Component. Dynamische Blöcke (Turniere,
 * Sponsoren, Social) lesen ihre Daten über den getaggten Cache, damit sie stets
 * aktuell sind, ohne bei jedem Aufruf die Datenbank zu belasten.
 *
 * Gestalterisch gehören alle Blöcke zum selben System: gemeinsamer Rahmen
 * (`SectionShell`), gemeinsame Überschrift mit Abschnittsnummer und ein
 * einheitliches Einblendverhalten. Dadurch funktioniert jede Reihenfolge und
 * jede Kombination, nicht nur die aktuelle Startseite.
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

/** Die gepflegte Tonalität eines Blocks auf die Abschnittsvarianten abbilden. */
function toneOf(tone: string | undefined): SectionTone {
  return tone === 'muted' || tone === 'accent' || tone === 'tech' ? tone : 'default';
}

/**
 * Platzhalter, der auf den in den Einstellungen gepflegten Discord-Link
 * verweist. So bleibt der Einladungslink an einer einzigen Stelle pflegbar.
 * Ist er nicht gesetzt, wird die Schaltfläche ausgelassen statt ins Leere zu führen.
 */
const DISCORD_TOKEN = '{discord}';

async function SectionLinkButton({
  link,
  fallbackStyle,
  size,
}: {
  link: SectionLink;
  fallbackStyle?: SectionLink['style'];
  size?: 'lg';
}) {
  const settings = await getSettings();
  const rawHref = link.href === DISCORD_TOKEN ? settings.discordInviteUrl : link.href;
  const href = safeUrl(rawHref);
  if (!href) return null;

  const style = link.style ?? fallbackStyle ?? 'primary';
  const base = style === 'primary' ? 'btn-primary' : style === 'secondary' ? 'btn-secondary' : 'btn-ghost';
  const className = size === 'lg' ? `${base} btn-lg` : base;
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
      <Icons.arrowRight size={15} />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Einzelne Blöcke
// ---------------------------------------------------------------------------

/**
 * Hero: räumliche Komposition aus Logo, technischem Hintergrund und
 * Community-Signalen. Auf kleinen Geräten wird die Komposition umgestellt,
 * aber nicht auf einen einfachen Textblock reduziert.
 */
async function HeroSection({ data, index }: { data: Extract<RenderableSection, { type: 'HERO' }>['data']; index: number }) {
  const [settings, background] = await Promise.all([
    getSettings(),
    data.backgroundMediaId ? loadMedia(data.backgroundMediaId) : Promise.resolve(null),
  ]);

  const stats = publishedStats(settings).slice(0, 3);
  const first = index === 0;

  return (
    <section className="relative isolate overflow-hidden">
      <TechBackdrop variant="hero" />

      {background ? (
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <MediaImage
            storageKey={background.storageKey}
            alt=""
            fill
            priority={first}
            sizes="100vw"
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-void)]/70 via-[var(--color-void)]/75 to-[var(--color-canvas)]" />
        </div>
      ) : null}

      <div className="shell relative py-16 sm:py-24 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          {/* Textspalte */}
          <div>
            {data.eyebrow ? (
              <Reveal>
                <p className="eyebrow">
                  <Icons.swiss size={14} />
                  {data.eyebrow}
                </p>
              </Reveal>
            ) : null}

            <Reveal index={1}>
              <h1 className="display-1">{data.headline}</h1>
            </Reveal>

            {data.motto ? (
              <Reveal index={2}>
                <p className="mt-5 flex items-center gap-3 text-lg font-semibold text-[var(--color-brand-text)] sm:text-xl">
                  <span aria-hidden="true" className="h-px w-8 bg-[var(--color-brand)]" />
                  «{data.motto}»
                </p>
              </Reveal>
            ) : null}

            {data.text ? (
              <Reveal index={3}>
                <p className="lead mt-6">{data.text}</p>
              </Reveal>
            ) : null}

            {data.primaryLink || data.secondaryLink ? (
              <Reveal index={4}>
                <div className="mt-9 flex flex-wrap gap-3">
                  {data.primaryLink ? <SectionLinkButton link={data.primaryLink} size="lg" /> : null}
                  {data.secondaryLink ? (
                    <SectionLinkButton link={data.secondaryLink} fallbackStyle="secondary" size="lg" />
                  ) : null}
                </div>
              </Reveal>
            ) : null}

            {/* Community-Signale: ausschliesslich veröffentlichte, gepflegte Werte. */}
            {stats.length > 0 ? (
              <Reveal index={5}>
                <dl className="mt-11 grid max-w-lg grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--color-line)] pt-7 sm:grid-cols-3">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <dt className="meta">{stat.label}</dt>
                      <dd className="mt-1 text-xl font-bold text-[var(--color-ink)] sm:text-2xl">
                        <AnimatedNumber value={stat.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            ) : null}
          </div>

          {/* Logo-Komposition */}
          {data.showLogo ? (
            <Reveal variant="scale" index={2} className="order-first flex justify-center lg:order-none lg:justify-end">
              <div className="relative">
                <LogoStage priority={first} />

                {/* Abstrahierte Verbindungen als Symbol für die Community. */}
                <span
                  aria-hidden="true"
                  className="hairline-brand absolute -left-16 top-1/2 hidden h-px w-16 lg:block"
                />
                <span
                  aria-hidden="true"
                  className="hairline-brand absolute -right-16 top-1/3 hidden h-px w-16 lg:block"
                />
              </div>
            </Reveal>
          ) : null}
        </div>
      </div>

      {/* Verbindungslinie in den nächsten Abschnitt. */}
      <span aria-hidden="true" className="connector absolute bottom-0 left-1/2 h-16 -translate-x-1/2" />
    </section>
  );
}

async function TextSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'TEXT' }>['data'];
  index: number;
}) {
  const settings = await getSettings();
  const body = applySettingsTokens(data.text, settings);
  const centered = data.align === 'center';

  return (
    <SectionShell tone={toneOf(data.tone)}>
      <div className={`max-w-3xl ${centered ? 'mx-auto text-center' : ''}`}>
        {data.eyebrow ? (
          <Reveal>
            <p className={`eyebrow ${centered ? 'justify-center' : ''}`}>
              {index ? (
                <span className="text-[var(--color-ink-subtle)]">{String(index).padStart(2, '0')}</span>
              ) : null}
              <span aria-hidden="true" className="h-px w-7 bg-[var(--color-brand)]" />
              {data.eyebrow}
            </p>
          </Reveal>
        ) : null}

        {data.headline ? (
          <Reveal index={1}>
            <h2 className="heading-lg mb-5">{data.headline}</h2>
          </Reveal>
        ) : null}

        {body
          ? body.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
              <Reveal key={paragraphIndex} index={paragraphIndex + 2}>
                <p className={`lead mb-4 last:mb-0 ${centered ? 'mx-auto' : ''}`}>{paragraph}</p>
              </Reveal>
            ))
          : null}
      </div>
    </SectionShell>
  );
}

async function RichTextSection({ data }: { data: Extract<RenderableSection, { type: 'RICH_TEXT' }>['data'] }) {
  const settings = await getSettings();
  const html = renderRichText(applySettingsTokens(data.markdown, settings));
  if (!html && !data.headline) return null;

  return (
    <SectionShell tone={toneOf(data.tone)} narrow>
      <Reveal>
        {data.headline ? <h2 className="heading-lg mb-6">{data.headline}</h2> : null}
        {/* Das HTML entsteht serverseitig aus Markdown und ist streng gefiltert. */}
        <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: html }} />
      </Reveal>
    </SectionShell>
  );
}

async function ImageSection({ data }: { data: Extract<RenderableSection, { type: 'IMAGE' }>['data'] }) {
  const media = data.mediaId ? await loadMedia(data.mediaId) : null;
  if (!media) return null;

  return (
    <section className="section-tight">
      <div className={data.width === 'wide' ? 'shell' : 'shell-narrow'}>
        <Reveal variant="scale">
          <figure className="group relative">
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-[calc(var(--radius-card)+0.5rem)] border border-[var(--color-line)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
            <MediaImage
              storageKey={media.storageKey}
              alt={media.alt ?? ''}
              width={media.width}
              height={media.height}
              sizes={data.width === 'wide' ? '(min-width: 1152px) 1088px, 92vw' : '(min-width: 768px) 736px, 92vw'}
              className={`relative h-auto w-full border border-[var(--color-line)] ${
                data.rounded ? 'rounded-[var(--radius-card)]' : ''
              }`}
            />
            {data.caption ? (
              <figcaption className="meta mt-3.5">{data.caption}</figcaption>
            ) : null}
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

async function GallerySection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'GALLERY' }>['data'];
  index: number;
}) {
  const media = await loadMediaMany(data.items.map((item) => item.mediaId));
  if (media.length === 0) return null;

  const columnClass =
    data.columns === 2
      ? 'sm:grid-cols-2'
      : data.columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <SectionShell>
      <SectionHeading headline={data.headline} index={index} />
      <ul className={`grid grid-cols-1 gap-4 ${columnClass}`}>
        {data.items.map((item, itemIndex) => {
          const asset = media.find((entry) => entry.id === item.mediaId);
          if (!asset) return null;

          return (
            <li key={`${item.mediaId}-${itemIndex}`} {...revealProps('up', itemIndex, 60)}>
              <figure className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-void)] transition-colors duration-300 group-hover:border-[var(--color-line-strong)]">
                  <MediaImage
                    storageKey={asset.storageKey}
                    alt={asset.alt ?? item.caption ?? ''}
                    fill
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
                    className="object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]"
                  />
                </div>
                {item.caption ? <figcaption className="meta mt-2.5">{item.caption}</figcaption> : null}
              </figure>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

async function VideoSection({ data }: { data: Extract<RenderableSection, { type: 'VIDEO' }>['data'] }) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost';
  const embed = resolveEmbed(data.url, host.split(':')[0]);
  if (!embed) return null;

  const poster = data.posterMediaId ? await loadMedia(data.posterMediaId) : null;

  return (
    <SectionShell narrow>
      <SectionHeading headline={data.headline} intro={data.description} />

      <Reveal variant="scale">
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
      </Reveal>
    </SectionShell>
  );
}

function CtaSection({ data }: { data: Extract<RenderableSection, { type: 'CTA' }>['data'] }) {
  const accent = data.tone === 'accent';

  return (
    <section className="section">
      <div className="shell">
        <Reveal variant="scale">
          <div
            className={`relative isolate overflow-hidden rounded-[var(--radius-panel)] border p-8 text-center sm:p-14 ${
              accent
                ? 'border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-soft)_70%,var(--color-surface))]'
                : 'border-[var(--color-line)] bg-[var(--color-surface)]'
            }`}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-50" />
            {accent ? (
              <span
                aria-hidden="true"
                data-ambient
                className="glow-orb glow-brand drift-slow pointer-events-none left-[calc(50%-14rem)] top-[-10rem] h-[28rem] w-[28rem] opacity-25"
              />
            ) : null}

            <div className="relative">
              <h2 className="display-2">{data.headline}</h2>
              {data.text ? <p className="lead mx-auto mt-4 max-w-xl">{data.text}</p> : null}

              {data.primaryLink || data.secondaryLink ? (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  {data.primaryLink ? <SectionLinkButton link={data.primaryLink} size="lg" /> : null}
                  {data.secondaryLink ? (
                    <SectionLinkButton link={data.secondaryLink} fallbackStyle="secondary" size="lg" />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CardGridSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'CARD_GRID' }>['data'];
  index: number;
}) {
  if (data.cards.length === 0) return null;

  const columnClass =
    data.columns === 2
      ? 'sm:grid-cols-2'
      : data.columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <SectionShell>
      <SectionHeading eyebrow={data.eyebrow} headline={data.headline} intro={data.intro} index={index} />

      <ul className={`grid grid-cols-1 gap-4 ${columnClass}`}>
        {data.cards.map((card, cardIndex) => {
          const CardIcon = Icons[card.icon as IconName] ?? Icons.community;
          const href = card.link ? safeUrl(card.link.href) : null;

          return (
            <li key={cardIndex} {...revealProps('up', cardIndex)}>
              <div className="card-tech card-interactive group relative flex h-full flex-col p-5 sm:p-6">
                <span
                  aria-hidden="true"
                  className="accent-line absolute inset-x-0 bottom-0 h-px bg-[var(--color-brand-bright)]"
                />

                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--color-brand)_35%,var(--color-line))] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)] transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-y-0.5">
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
                  <p className="link-arrow mt-auto pt-5">
                    {card.link.label}
                    <Icons.arrowRight size={15} />
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

/**
 * Statistiken als Community-Konsole statt als Reihe gleicher Kästchen.
 * Es werden ausschliesslich gepflegte und veröffentlichte Werte angezeigt.
 */
async function StatsSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'STATS' }>['data'];
  index: number;
}) {
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
    <SectionShell tone="tech">
      <SectionHeading headline={data.headline} align="center" index={index} />

      <Reveal>
        <div className="panel-glass corner-ticks relative overflow-hidden p-2">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-60" />

          <dl className="relative grid grid-cols-2 divide-[var(--color-line)] sm:divide-x lg:grid-cols-4">
            {items.map((item, itemIndex) => (
              <div
                key={itemIndex}
                className="px-5 py-7 text-center sm:px-6"
                {...revealProps('up', itemIndex, 90)}
              >
                <dt className="meta">{item.label}</dt>
                <dd>
                  <span className="mt-2 block text-3xl font-extrabold tracking-tight text-[var(--color-ink)] sm:text-4xl">
                    <AnimatedNumber value={item.value} />
                  </span>
                  {item.description ? (
                    <span className="mt-2 block text-xs leading-relaxed text-[var(--color-ink-subtle)]">
                      {item.description}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </SectionShell>
  );
}

function FaqSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'FAQ' }>['data'];
  index: number;
}) {
  if (data.items.length === 0) return null;

  return (
    <SectionShell narrow>
      <SectionHeading headline={data.headline} intro={data.intro} index={index} />

      <div className="space-y-3">
        {data.items.map((item, itemIndex) => (
          /* <details> funktioniert ohne JavaScript und ist von Haus aus zugänglich. */
          <details
            key={itemIndex}
            className="card group px-5 py-4 transition-colors duration-300 hover:border-[var(--color-line-strong)] open:border-[color-mix(in_srgb,var(--color-brand)_40%,var(--color-line))] open:bg-[var(--color-surface-raised)] [&[open]>summary>span>svg]:rotate-45"
            {...revealProps('up', itemIndex, 50)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[var(--color-ink)]">
              {item.question}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-void)]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  className="text-[var(--color-brand-text)] transition-transform duration-300 ease-[var(--ease-out-soft)]"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <div className="prose-swisshub mt-3.5" dangerouslySetInnerHTML={{ __html: renderRichText(item.answer) }} />
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

async function LogoBarSection({ data }: { data: Extract<RenderableSection, { type: 'LOGO_BAR' }>['data'] }) {
  const sponsors =
    data.sponsorIds.length > 0 ? await getSponsorsByIds(data.sponsorIds) : await getSponsors('ACTIVE', 12);
  if (sponsors.length === 0) return null;

  const settings = await getSettings();

  return (
    <section className="relative border-y border-[var(--color-line)] bg-[var(--color-void)]">
      <div className="shell section-tight relative">
        {data.showTitle ? (
          <Reveal>
            <h2 className="meta mb-7 text-center">{data.headline || settings.sponsorSectionLabel}</h2>
          </Reveal>
        ) : null}

        <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {sponsors.map((sponsor, sponsorIndex) => {
            const website = safeUrl(sponsor.websiteUrl);
            const content = <SponsorLogo sponsor={sponsor} />;

            return (
              <li key={sponsor.id} className="logo-plate min-w-[9rem]" {...revealProps('up', sponsorIndex, 45)}>
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
  index,
}: {
  data: Extract<RenderableSection, { type: 'SOCIAL_HIGHLIGHTS' }>['data'];
  index: number;
}) {
  // Der Bereich lässt sich im Dashboard vollständig abschalten.
  if (!(await isFeatureEnabled(FEATURE_FLAGS.socialHighlights))) return null;

  const posts = await getSocialPosts({
    platforms: data.platforms.length > 0 ? data.platforms : undefined,
    onlyFeatured: data.onlyFeatured,
    limit: data.limit,
  });

  return (
    <SectionShell>
      <SectionHeading
        headline={data.headline}
        intro={data.intro}
        index={index}
        action={
          posts.length > 0 ? (
            <Link href="/social" className="btn-secondary">
              Alle Kanäle
              <Icons.arrowRight size={15} />
            </Link>
          ) : null
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icon="chat"
          title="Noch keine Beiträge freigegeben"
          description="Sobald wir Beiträge kuratieren, erscheinen sie hier. Aktuelles findest du jederzeit auf unseren Kanälen."
          action={{ href: '/social', label: 'Zu unseren Kanälen' }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, postIndex) => (
            <li key={post.id} {...revealProps('up', postIndex)}>
              <SocialPostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

async function TournamentListSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'TOURNAMENT_LIST' }>['data'];
  index: number;
}) {
  // Ist das Turnierarchiv abgeschaltet, entfällt der Rückblick auf der Website.
  const archiveEnabled = await isFeatureEnabled(FEATURE_FLAGS.tournamentArchive);
  if (data.filter === 'past' && !archiveEnabled) return null;

  const tournaments =
    data.filter === 'featured'
      ? await getFeaturedTournaments(data.limit)
      : data.filter === 'past'
        ? await getPastTournaments(data.limit)
        : data.filter === 'running'
          ? await getRunningTournaments(data.limit)
          : data.filter === 'all'
            ? (await getVisiblePublicTournaments()).slice(0, data.limit)
            : await getUpcomingTournaments(data.limit);

  return (
    <SectionShell>
      <SectionHeading
        headline={data.headline}
        intro={data.intro}
        index={index}
        action={
          data.showLinkToOverview && tournaments.length > 0 ? (
            <Link href="/turniere" className="btn-secondary">
              Alle Turniere
              <Icons.arrowRight size={15} />
            </Link>
          ) : null
        }
      />

      {tournaments.length === 0 ? (
        <EmptyState
          icon="tournament"
          title="Aktuell sind keine Turniere ausgeschrieben"
          description={
            archiveEnabled
              ? 'Neue Turniere kündigen wir zuerst auf unserem Discord an. Im Archiv siehst du, was bisher gespielt wurde.'
              : 'Neue Turniere kündigen wir zuerst auf unserem Discord an.'
          }
          action={{ href: '/turniere', label: 'Zur Turnierübersicht' }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament, tournamentIndex) => (
            <li key={tournament.id} {...revealProps('up', tournamentIndex)}>
              <TournamentCard tournament={tournament} />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

async function SponsorListSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'SPONSOR_LIST' }>['data'];
  index: number;
}) {
  const sponsors = await getSponsors(data.status === 'ALL' ? 'ALL' : data.status, data.limit);

  return (
    <SectionShell tone="muted">
      <SectionHeading headline={data.headline} intro={data.intro} index={index} />

      {sponsors.length === 0 ? (
        <EmptyState
          icon="shield"
          title="Noch keine Partner veröffentlicht"
          description="Du möchtest SwissHub unterstützen? Wir freuen uns über deine Anfrage."
          action={{ href: '/kontakt?kategorie=sponsoring', label: 'Sponsoring anfragen' }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor, sponsorIndex) => (
            <li key={sponsor.id} {...revealProps('up', sponsorIndex)}>
              <SponsorCard sponsor={sponsor} showDescription={data.showDescription} />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

async function TeamMembersSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'TEAM_MEMBERS' }>['data'];
  index: number;
}) {
  if (!(await isFeatureEnabled(FEATURE_FLAGS.teamSection))) return null;

  const members = await getTeamMembers(data.limit);
  if (members.length === 0) return null;

  return (
    <SectionShell>
      <SectionHeading headline={data.headline} intro={data.intro} index={index} />

      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {members.map((member, memberIndex) => (
          <li key={member.id} {...revealProps('up', memberIndex, 60)}>
            <article className="card-interactive group relative flex h-full flex-col items-center p-5 text-center">
              <span aria-hidden="true" className="accent-line absolute inset-x-0 top-0 h-px bg-[var(--color-brand)]" />

              <div className="relative mb-4">
                <span
                  aria-hidden="true"
                  className="absolute -inset-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-brand)_35%,transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
                <div className="h-20 w-20 overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
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
              </div>

              <h3 className="text-base font-semibold text-[var(--color-ink)]">{member.name}</h3>
              <p className="meta-brand mt-1">{member.role}</p>

              {member.description ? (
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">{member.description}</p>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function SpacerSection({ data }: { data: Extract<RenderableSection, { type: 'SPACER' }>['data'] }) {
  const height = data.size === 'small' ? 'h-6' : data.size === 'large' ? 'h-20' : 'h-12';

  if (data.showDivider) {
    return (
      <div className="shell">
        <div
          className={`relative flex items-center justify-center ${
            data.size === 'small' ? 'my-6' : data.size === 'large' ? 'my-20' : 'my-12'
          }`}
        >
          <span aria-hidden="true" className="hairline w-full" />
          <span
            aria-hidden="true"
            className="absolute h-1.5 w-1.5 rotate-45 border border-[var(--color-brand)] bg-[var(--color-canvas)]"
          />
        </div>
      </div>
    );
  }

  return <div className={height} aria-hidden="true" />;
}

async function TwoColumnSection({
  data,
  index,
}: {
  data: Extract<RenderableSection, { type: 'TWO_COLUMN' }>['data'];
  index: number;
}) {
  const ratioClass =
    data.ratio === '60-40'
      ? 'lg:grid-cols-[3fr_2fr]'
      : data.ratio === '40-60'
        ? 'lg:grid-cols-[2fr_3fr]'
        : 'lg:grid-cols-2';

  const [left, right] = await Promise.all([renderColumn(data.left), renderColumn(data.right)]);

  return (
    <SectionShell tone={toneOf(data.tone)}>
      <SectionHeading eyebrow={data.eyebrow} headline={data.headline} index={index} />

      <div
        className={`grid grid-cols-1 gap-8 lg:gap-12 ${ratioClass} ${
          data.verticalAlign === 'center' ? 'lg:items-center' : 'lg:items-start'
        }`}
      >
        <Reveal variant="left">{left}</Reveal>
        <Reveal variant="right" index={1}>
          {right}
        </Reveal>
      </div>
    </SectionShell>
  );
}

async function renderColumn(column: Extract<RenderableSection, { type: 'TWO_COLUMN' }>['data']['left']) {
  if (column.kind === 'image') {
    const media = column.mediaId ? await loadMedia(column.mediaId) : null;
    if (!media) return <div />;

    return (
      <div>
        {column.headline ? <h3 className="heading-md mb-5">{column.headline}</h3> : null}
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
        {column.headline ? <h3 className="heading-md mb-5">{column.headline}</h3> : null}
        <ul className="flex flex-wrap gap-3">
          {column.links.map((link, linkIndex) => (
            <li key={linkIndex}>
              <SectionLinkButton link={link} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      {column.headline ? <h3 className="heading-md mb-5">{column.headline}</h3> : null}
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

/** Blöcke ohne eigene Überschrift bekommen keine Abschnittsnummer. */
const UNNUMBERED = new Set(['HERO', 'SPACER', 'IMAGE', 'LOGO_BAR', 'CTA', 'RICH_TEXT', 'VIDEO']);

/**
 * Prüft vorab, ob ein Block überhaupt etwas ausgibt.
 *
 * Nötig für eine lückenlose Nummerierung: Blöcke, die mangels Inhalt oder
 * wegen eines abgeschalteten Schalters nichts rendern, dürfen keine Nummer
 * verbrauchen. Alle hier verwendeten Abfragen laufen über denselben getaggten
 * Cache wie der Block selbst und verursachen deshalb keine zusätzliche Last.
 */
async function willRender(section: RenderableSection): Promise<boolean> {
  switch (section.type) {
    case 'STATS': {
      if (!section.data.useCommunityStats) return section.data.items.length > 0;
      return publishedStats(await getSettings()).length > 0;
    }
    case 'TOURNAMENT_LIST':
      return section.data.filter !== 'past' || (await isFeatureEnabled(FEATURE_FLAGS.tournamentArchive));
    case 'SOCIAL_HIGHLIGHTS':
      return isFeatureEnabled(FEATURE_FLAGS.socialHighlights);
    case 'TEAM_MEMBERS':
      if (!(await isFeatureEnabled(FEATURE_FLAGS.teamSection))) return false;
      return (await getTeamMembers(section.data.limit)).length > 0;
    case 'CARD_GRID':
      return section.data.cards.length > 0;
    case 'FAQ':
      return section.data.items.length > 0;
    case 'GALLERY':
      return section.data.items.length > 0;
    default:
      return true;
  }
}

export async function SectionRenderer({ sections }: { sections: RenderableSection[] }) {
  const visible = sections.filter((section) => section.visible);

  // Fortlaufende Nummerierung über die sichtbaren, nummerierten Abschnitte.
  const flags = await Promise.all(
    visible.map(async (section) => !UNNUMBERED.has(section.type) && (await willRender(section))),
  );

  // Ohne veränderliche Zählvariable, damit die Nummerierung rein aus den
  // vorher ermittelten Werten hervorgeht.
  const numbered = visible.map((section, position) => ({
    section,
    index: flags[position] ? flags.slice(0, position + 1).filter(Boolean).length : 0,
  }));

  return (
    <>
      {numbered.map(({ section, index }) => (
        <RenderSection key={section.id} section={section} index={index} />
      ))}
    </>
  );
}

async function RenderSection({ section, index }: { section: RenderableSection; index: number }) {
  switch (section.type) {
    case 'HERO':
      return <HeroSection data={section.data} index={index} />;
    case 'TEXT':
      return <TextSection data={section.data} index={index} />;
    case 'RICH_TEXT':
      return <RichTextSection data={section.data} />;
    case 'IMAGE':
      return <ImageSection data={section.data} />;
    case 'GALLERY':
      return <GallerySection data={section.data} index={index} />;
    case 'VIDEO':
      return <VideoSection data={section.data} />;
    case 'CTA':
      return <CtaSection data={section.data} />;
    case 'CARD_GRID':
      return <CardGridSection data={section.data} index={index} />;
    case 'STATS':
      return <StatsSection data={section.data} index={index} />;
    case 'FAQ':
      return <FaqSection data={section.data} index={index} />;
    case 'LOGO_BAR':
      return <LogoBarSection data={section.data} />;
    case 'SOCIAL_HIGHLIGHTS':
      return <SocialHighlightsSection data={section.data} index={index} />;
    case 'TOURNAMENT_LIST':
      return <TournamentListSection data={section.data} index={index} />;
    case 'SPONSOR_LIST':
      return <SponsorListSection data={section.data} index={index} />;
    case 'TEAM_MEMBERS':
      return <TeamMembersSection data={section.data} index={index} />;
    case 'SPACER':
      return <SpacerSection data={section.data} />;
    case 'TWO_COLUMN':
      return <TwoColumnSection data={section.data} index={index} />;
    default:
      return null;
  }
}
