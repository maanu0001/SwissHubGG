import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { MediaImage } from '@/components/site/MediaImage';
import { LazyEmbed } from '@/components/site/LazyEmbed';
import { SponsorLogo } from '@/components/site/SponsorCard';
import { TOURNAMENT_STATUS_META } from '@/components/site/TournamentCard';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { getTournamentBySlug } from '@/lib/content/queries';
import { breadcrumbJsonLd, buildMetadata, tournamentJsonLd } from '@/lib/seo';
import { env } from '@/lib/env';
import { formatDate, formatDateRange, formatDateTime } from '@/lib/format';
import { renderRichText, safeUrl } from '@/lib/sanitize';
import { resolveEmbed } from '@/lib/content/embeds';
import { getSettings } from '@/lib/settings';

/** Turnierdetailseite mit allen gepflegten Angaben, Ergebnissen und Sponsoren. */

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    return { title: 'Turnier nicht gefunden', robots: { index: false, follow: false } };
  }

  return buildMetadata({
    title: tournament.seoTitle ?? `${tournament.title}${tournament.game ? ` – ${tournament.game.name}` : ''}`,
    description: tournament.seoDescription ?? tournament.summary ?? tournament.description,
    path: `/turniere/${slug}`,
    imageKey: tournament.seoImage?.storageKey ?? tournament.banner?.storageKey ?? null,
    type: 'article',
    publishedTime: tournament.publishedAt,
  });
}

export default async function TournamentDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament) {
    notFound();
  }

  const [settings, headerList] = await Promise.all([getSettings(), headers()]);
  const host = (headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost').split(':')[0];

  const status = TOURNAMENT_STATUS_META[tournament.status];
  const registrationUrl = safeUrl(tournament.registrationUrl);
  const streamEmbed = tournament.streamUrl ? resolveEmbed(tournament.streamUrl, host) : null;
  const discordUrl = safeUrl(tournament.discordUrl) ?? safeUrl(settings.discordInviteUrl);
  const recap = tournament.recapUrl ? resolveEmbed(tournament.recapUrl, host) : null;

  const registrationOpen = tournament.status === 'REGISTRATION_OPEN';

  const facts: { label: string; value: string }[] = [
    { label: 'Zeitraum', value: formatDateRange(tournament.startsAt, tournament.endsAt) },
    ...(tournament.startsAt ? [{ label: 'Start', value: formatDateTime(tournament.startsAt) }] : []),
    ...(tournament.registrationOpensAt || tournament.registrationClosesAt
      ? [
          {
            label: 'Anmeldezeitraum',
            value: formatDateRange(tournament.registrationOpensAt, tournament.registrationClosesAt),
          },
        ]
      : []),
    ...(tournament.game ? [{ label: 'Spiel', value: tournament.game.name }] : []),
    ...(tournament.format ? [{ label: 'Format', value: tournament.format }] : []),
    ...(tournament.maxParticipants
      ? [
          {
            label: tournament.participantUnit === 'PLAYER' ? 'Maximale Teilnehmende' : 'Maximale Teams',
            value: String(tournament.maxParticipants),
          },
        ]
      : []),
    ...(tournament.prizeInfo ? [{ label: 'Preise', value: tournament.prizeInfo }] : []),
  ];

  return (
    <>
      <JsonLd
        data={tournamentJsonLd(
          {
            title: tournament.title,
            slug: tournament.slug,
            summary: tournament.summary,
            description: tournament.description,
            startsAt: tournament.startsAt,
            endsAt: tournament.endsAt,
            status: tournament.status,
            bannerKey: tournament.banner?.storageKey ?? null,
            registrationUrl: tournament.registrationUrl,
            gameName: tournament.game?.name ?? null,
          },
          `${env().APP_URL}/#organization`,
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Start', path: '/' },
          { name: 'Turniere', path: '/turniere' },
          { name: tournament.title, path: `/turniere/${slug}` },
        ])}
      />

      <article>
        <header className="border-b border-[var(--color-line)] hero-veil">
          <div className="shell py-10 sm:py-14">
            <nav aria-label="Brotkrumen" className="mb-6 text-sm text-[var(--color-ink-subtle)]">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="hover:text-[var(--color-ink-muted)]">Start</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/turniere" className="hover:text-[var(--color-ink-muted)]">Turniere</Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[var(--color-ink-muted)]" aria-current="page">{tournament.title}</li>
              </ol>
            </nav>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className={status.badge}>{status.label}</span>
                  {tournament.game ? <span className="badge-neutral">{tournament.game.name}</span> : null}
                  {tournament.featured ? <span className="badge-brand">Highlight</span> : null}
                </div>

                <h1 className="heading-xl">{tournament.title}</h1>
                {tournament.summary ? <p className="lead mt-4 max-w-2xl">{tournament.summary}</p> : null}

                <div className="mt-7 flex flex-wrap gap-3">
                  {registrationUrl && registrationOpen ? (
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      Jetzt anmelden
                      <Icons.external size={13} />
                    </a>
                  ) : null}
                  {registrationUrl && !registrationOpen ? (
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                      Turnierseite öffnen
                      <Icons.external size={13} />
                    </a>
                  ) : null}
                  {discordUrl ? (
                    <a
                      href={discordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-track-social="DISCORD"
                      className={registrationUrl && registrationOpen ? 'btn-secondary' : 'btn-primary'}
                    >
                      <Icons.discord size={17} />
                      Fragen? Ab in den Discord
                    </a>
                  ) : null}
                </div>
              </div>

              {tournament.banner ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
                  <MediaImage
                    storageKey={tournament.banner.storageKey}
                    alt={tournament.banner.alt ?? `Turnierbanner: ${tournament.title}`}
                    fill
                    priority
                    sizes="(min-width: 1024px) 420px, 92vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="shell section grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-12">
            {tournament.description ? (
              <section aria-labelledby="beschreibung">
                <h2 id="beschreibung" className="heading-md mb-4">Über das Turnier</h2>
                <div
                  className="prose-swisshub"
                  dangerouslySetInnerHTML={{ __html: renderRichText(tournament.description) }}
                />
              </section>
            ) : null}

            {tournament.rules ? (
              <section aria-labelledby="regeln">
                <h2 id="regeln" className="heading-md mb-4">Regeln</h2>
                <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: renderRichText(tournament.rules) }} />
              </section>
            ) : null}

            {streamEmbed && streamEmbed.kind !== 'link' ? (
              <section aria-labelledby="stream">
                <h2 id="stream" className="heading-md mb-4">Livestream</h2>
                <LazyEmbed
                  provider={streamEmbed.kind}
                  embedUrl={streamEmbed.embedUrl}
                  externalUrl={streamEmbed.externalUrl}
                  title={`Livestream: ${tournament.title}`}
                />
              </section>
            ) : null}

            {tournament.results.length > 0 ? (
              <section aria-labelledby="ergebnisse">
                <h2 id="ergebnisse" className="heading-md mb-4">Ergebnisse</h2>
                {tournament.resultSummary ? (
                  <div
                    className="prose-swisshub mb-5"
                    dangerouslySetInnerHTML={{ __html: renderRichText(tournament.resultSummary) }}
                  />
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <caption className="sr-only">Platzierungen im Turnier {tournament.title}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-[var(--color-line-strong)] px-3 py-2 text-left font-semibold">Platz</th>
                        <th scope="col" className="border-b border-[var(--color-line-strong)] px-3 py-2 text-left font-semibold">Team / Person</th>
                        <th scope="col" className="border-b border-[var(--color-line-strong)] px-3 py-2 text-left font-semibold">Preis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.results.map((result) => (
                        <tr key={result.id}>
                          <td className="border-b border-[var(--color-line)] px-3 py-2.5 font-semibold text-[var(--color-brand-text)]">
                            {result.placement}.
                          </td>
                          <td className="border-b border-[var(--color-line)] px-3 py-2.5 text-[var(--color-ink)]">
                            {result.team?.name ?? result.displayName}
                            {result.note ? (
                              <span className="block text-xs text-[var(--color-ink-subtle)]">{result.note}</span>
                            ) : null}
                          </td>
                          <td className="border-b border-[var(--color-line)] px-3 py-2.5 text-[var(--color-ink-muted)]">
                            {result.prize ?? '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {tournament.teams.length > 0 ? (
              <section aria-labelledby="teams">
                <h2 id="teams" className="heading-md mb-4">
                  Teilnehmende {tournament.participantUnit === 'PLAYER' ? 'Spielerinnen und Spieler' : 'Teams'}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {tournament.teams.map((team) => (
                    <li key={team.id} className="badge-neutral px-3 py-1.5">
                      {team.tag ? <span className="font-semibold text-[var(--color-ink)]">{team.tag}</span> : null}
                      {team.name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {tournament.media.length > 0 ? (
              <section aria-labelledby="galerie">
                <h2 id="galerie" className="heading-md mb-4">Rückblick</h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tournament.media.map((entry) => (
                    <li key={entry.id}>
                      <figure>
                        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
                          <MediaImage
                            storageKey={entry.media.storageKey}
                            alt={entry.media.alt ?? entry.caption ?? ''}
                            fill
                            sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
                            className="object-cover"
                          />
                        </div>
                        {entry.caption ? (
                          <figcaption className="mt-2 text-xs text-[var(--color-ink-subtle)]">{entry.caption}</figcaption>
                        ) : null}
                      </figure>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {recap && recap.kind !== 'link' ? (
              <section aria-labelledby="video-rueckblick">
                <h2 id="video-rueckblick" className="heading-md mb-4">Video-Rückblick</h2>
                <LazyEmbed
                  provider={recap.kind}
                  embedUrl={recap.embedUrl}
                  externalUrl={recap.externalUrl}
                  title={`Rückblick: ${tournament.title}`}
                />
              </section>
            ) : null}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="panel">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-subtle)]">
                Auf einen Blick
              </h2>
              <dl className="space-y-3">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-xs text-[var(--color-ink-subtle)]">{fact.label}</dt>
                    <dd className="text-sm text-[var(--color-ink)]">{fact.value}</dd>
                  </div>
                ))}
                {tournament.winnerName ? (
                  <div>
                    <dt className="text-xs text-[var(--color-ink-subtle)]">Gewinner</dt>
                    <dd className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand-text)]">
                      <Icons.star size={14} />
                      {tournament.winnerName}
                    </dd>
                  </div>
                ) : null}
                {tournament.publishedAt ? (
                  <div>
                    <dt className="text-xs text-[var(--color-ink-subtle)]">Veröffentlicht</dt>
                    <dd className="text-sm text-[var(--color-ink-muted)]">
                      <time dateTime={tournament.publishedAt.toISOString()}>{formatDate(tournament.publishedAt)}</time>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {tournament.sponsors.length > 0 ? (
              <div className="panel">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-subtle)]">
                  Unterstützt von
                </h2>
                <ul className="space-y-3">
                  {tournament.sponsors.map((entry) => {
                    const website = safeUrl(entry.sponsor.websiteUrl);
                    const logo = <SponsorLogo sponsor={entry.sponsor} />;

                    return (
                      <li key={entry.sponsor.id} className="logo-plate justify-start gap-3">
                        {website ? (
                          <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            data-track-sponsor={entry.sponsor.slug}
                            className="flex items-center gap-3"
                          >
                            {logo}
                            <span className="sr-only">{entry.sponsor.name} (öffnet in neuem Tab)</span>
                          </a>
                        ) : (
                          logo
                        )}
                        {entry.role ? (
                          <span className="text-xs text-[var(--color-ink-subtle)]">{entry.role}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="panel">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Fragen zum Turnier?</h2>
              <p className="muted mb-4">
                Support und persönliche Anliegen klären wir über das Ticketsystem auf unserem Discord.
              </p>
              {discordUrl ? (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track-social="DISCORD"
                  className="btn-secondary w-full"
                >
                  <Icons.discord size={17} />
                  Zum Discord
                </a>
              ) : (
                <Link href="/kontakt" className="btn-secondary w-full">
                  Kontakt aufnehmen
                </Link>
              )}
            </div>
          </aside>
        </div>
      </article>
    </>
  );
}
