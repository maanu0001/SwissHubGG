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
import { EmptyState } from '@/components/ui/EmptyState';
import { getTournamentBySlug, isTournamentPubliclyVisible } from '@/lib/content/queries';
import { breadcrumbJsonLd, buildMetadata, tournamentJsonLd } from '@/lib/seo';
import { env } from '@/lib/env';
import { formatCountdown, formatDate, formatDateRange, formatDateTime } from '@/lib/format';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal, revealProps } from '@/components/visual/Reveal';
import { renderRichText, safeUrl } from '@/lib/sanitize';
import { resolveEmbed } from '@/lib/content/embeds';
import { getSettings } from '@/lib/settings';

/** Turnierdetailseite mit allen gepflegten Angaben, Ergebnissen und Sponsoren. */

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);

  if (!tournament || !(await isTournamentPubliclyVisible(tournament.status))) {
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

  // Bei abgeschaltetem Archiv ist auch die Detailseite nicht erreichbar.
  if (!tournament || !(await isTournamentPubliclyVisible(tournament.status))) {
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

  // Nur bei einem echten, in der Zukunft liegenden Termin.
  const countdown =
    tournament.status === 'RUNNING' || tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED'
      ? null
      : formatCountdown(tournament.startsAt);

  // Hat die Hauptspalte überhaupt Inhalt? Sonst entstünde eine leere Fläche.
  const hasDetails = Boolean(
    tournament.description ||
      tournament.rules ||
      (streamEmbed && streamEmbed.kind !== 'link') ||
      tournament.results.length > 0 ||
      tournament.teams.length > 0 ||
      tournament.media.length > 0 ||
      (recap && recap.kind !== 'link'),
  );

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
        <header className="relative isolate overflow-hidden border-b border-[var(--color-line)]">
          <TechBackdrop variant="hero" />

          <div className="shell relative py-10 sm:py-16">
            <nav aria-label="Brotkrumen" className="mb-7 text-sm text-[var(--color-ink-subtle)]">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="transition-colors hover:text-[var(--color-ink-muted)]">
                    Start
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/turniere" className="transition-colors hover:text-[var(--color-ink-muted)]">
                    Turniere
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="text-[var(--color-ink-muted)]" aria-current="page">
                  {tournament.title}
                </li>
              </ol>
            </nav>

            <div className="grid gap-9 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-center">
              <Reveal>
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className={status.badge}>
                    {tournament.status === 'RUNNING' ? <span className="pulse-dot h-1.5 w-1.5" /> : null}
                    {status.label}
                  </span>
                  {tournament.game ? <span className="badge-tech">{tournament.game.name}</span> : null}
                  {tournament.featured ? <span className="badge-brand">Highlight</span> : null}
                  {countdown ? (
                    <span className="badge-tech text-[var(--color-brand-text)]">
                      <Icons.clock size={12} />
                      Start {countdown.toLowerCase()}
                    </span>
                  ) : null}
                </div>

                <h1 className="display-2">{tournament.title}</h1>
                {tournament.summary ? <p className="lead mt-5">{tournament.summary}</p> : null}

                <div className="mt-8 flex flex-wrap gap-3">
                  {registrationUrl && registrationOpen ? (
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg">
                      Jetzt anmelden
                      <Icons.external size={13} />
                    </a>
                  ) : null}
                  {registrationUrl && !registrationOpen ? (
                    <a href={registrationUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-lg">
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
                      className={registrationUrl && registrationOpen ? 'btn-secondary btn-lg' : 'btn-primary btn-lg'}
                    >
                      <Icons.discord size={17} />
                      Fragen? Ab in den Discord
                    </a>
                  ) : null}
                </div>
              </Reveal>

              {tournament.banner ? (
                <Reveal variant="scale" index={1}>
                  <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] shadow-[var(--shadow-raised)]">
                    <MediaImage
                      storageKey={tournament.banner.storageKey}
                      alt={tournament.banner.alt ?? `Turnierbanner: ${tournament.title}`}
                      fill
                      priority
                      sizes="(min-width: 1024px) 420px, 92vw"
                      className="object-cover"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--color-void)_45%,transparent)] to-transparent"
                    />
                  </div>
                </Reveal>
              ) : null}
            </div>
          </div>
        </header>

        <div className="shell section grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          {/* min-w-0 verhindert, dass die Ergebnistabelle die Spalte aufweitet. */}
          <div className="min-w-0 space-y-12">
            {/* Frisch ausgeschriebene Turniere haben oft nur eine Kurzfassung.
                Statt einer leeren Spalte steht dann ein ehrlicher Hinweis. */}
            {!hasDetails ? (
              <EmptyState
                icon="tournament"
                title="Die ausführlichen Angaben folgen"
                description={
                  registrationUrl
                    ? 'Format, Regeln und Ablauf ergänzen wir, sobald sie feststehen. Die Anmeldung ist bereits möglich – Neuigkeiten kündigen wir zuerst auf unserem Discord an.'
                    : 'Format, Regeln und Ablauf ergänzen wir, sobald sie feststehen. Neuigkeiten kündigen wir zuerst auf unserem Discord an.'
                }
                action={discordUrl ? { href: discordUrl, label: 'Discord beitreten', external: true } : undefined}
              />
            ) : null}

            {tournament.description ? (
              <section {...revealProps('up')} aria-labelledby="beschreibung">
                <h2 id="beschreibung" className="heading-md mb-5">Über das Turnier</h2>
                <div
                  className="prose-swisshub"
                  dangerouslySetInnerHTML={{ __html: renderRichText(tournament.description) }}
                />
              </section>
            ) : null}

            {tournament.rules ? (
              <section {...revealProps('up')} aria-labelledby="regeln">
                <h2 id="regeln" className="heading-md mb-5">Regeln</h2>
                <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: renderRichText(tournament.rules) }} />
              </section>
            ) : null}

            {streamEmbed && streamEmbed.kind !== 'link' ? (
              <section {...revealProps('up')} aria-labelledby="stream">
                <h2 id="stream" className="heading-md mb-5">Livestream</h2>
                <LazyEmbed
                  provider={streamEmbed.kind}
                  embedUrl={streamEmbed.embedUrl}
                  externalUrl={streamEmbed.externalUrl}
                  title={`Livestream: ${tournament.title}`}
                />
              </section>
            ) : null}

            {tournament.results.length > 0 ? (
              <section {...revealProps('up')} aria-labelledby="ergebnisse">
                <h2 id="ergebnisse" className="heading-md mb-5">Ergebnisse</h2>
                {tournament.resultSummary ? (
                  <div
                    className="prose-swisshub mb-5"
                    dangerouslySetInnerHTML={{ __html: renderRichText(tournament.resultSummary) }}
                  />
                ) : null}
                <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-line)]">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <caption className="sr-only">Platzierungen im Turnier {tournament.title}</caption>
                    <thead className="bg-[var(--color-void)]">
                      <tr>
                        <th scope="col" className="meta border-b border-[var(--color-line)] px-4 py-3 text-left">
                          Platz
                        </th>
                        <th scope="col" className="meta border-b border-[var(--color-line)] px-4 py-3 text-left">
                          Team / Person
                        </th>
                        <th scope="col" className="meta border-b border-[var(--color-line)] px-4 py-3 text-left">
                          Preis
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournament.results.map((result) => {
                        // Die ersten drei Plätze werden sichtbar hervorgehoben.
                        const podium = result.placement <= 3;

                        return (
                          <tr
                            key={result.id}
                            className={`transition-colors duration-200 hover:bg-[var(--color-surface-raised)] ${
                              podium ? 'bg-[color-mix(in_srgb,var(--color-brand-soft)_55%,transparent)]' : ''
                            }`}
                          >
                            <td className="border-b border-[var(--color-line)] px-4 py-3">
                              <span
                                className={`numeric inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                  result.placement === 1
                                    ? 'bg-[var(--color-brand)] text-[var(--color-brand-contrast)]'
                                    : podium
                                      ? 'border border-[color-mix(in_srgb,var(--color-brand)_50%,transparent)] text-[var(--color-brand-text)]'
                                      : 'border border-[var(--color-line)] text-[var(--color-ink-muted)]'
                                }`}
                              >
                                {result.placement}
                              </span>
                            </td>
                            <td className="border-b border-[var(--color-line)] px-4 py-3">
                              <span className={podium ? 'font-semibold text-[var(--color-ink)]' : 'text-[var(--color-ink)]'}>
                                {result.team?.name ?? result.displayName}
                              </span>
                              {result.note ? (
                                <span className="block text-xs text-[var(--color-ink-subtle)]">{result.note}</span>
                              ) : null}
                            </td>
                            <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                              {result.prize ?? '–'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {tournament.teams.length > 0 ? (
              <section {...revealProps('up')} aria-labelledby="teams">
                <h2 id="teams" className="heading-md mb-5">
                  Teilnehmende {tournament.participantUnit === 'PLAYER' ? 'Spielerinnen und Spieler' : 'Teams'}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {tournament.teams.map((team) => (
                    <li key={team.id} className="badge-tech gap-2 px-3.5 py-2 text-[var(--color-ink)]">
                      {team.tag ? <span className="font-semibold text-[var(--color-ink)]">{team.tag}</span> : null}
                      {team.name}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {tournament.media.length > 0 ? (
              <section {...revealProps('up')} aria-labelledby="galerie">
                <h2 id="galerie" className="heading-md mb-5">Rückblick</h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tournament.media.map((entry, mediaIndex) => (
                    <li key={entry.id} {...revealProps('up', mediaIndex, 60)}>
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
              <section {...revealProps('up')} aria-labelledby="video-rueckblick">
                <h2 id="video-rueckblick" className="heading-md mb-5">Video-Rückblick</h2>
                <LazyEmbed
                  provider={recap.kind}
                  embedUrl={recap.embedUrl}
                  externalUrl={recap.externalUrl}
                  title={`Rückblick: ${tournament.title}`}
                />
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            {/* Gewinner steht als Leistungsnachweis zuoberst, sobald gepflegt. */}
            {tournament.winnerName ? (
              <div className="panel corner-ticks relative overflow-hidden border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-line))] bg-[var(--color-brand-soft)]">
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-45" />
                <div className="relative">
                  <p className="meta-brand mb-2 flex items-center gap-2">
                    <Icons.star size={13} />
                    Siegerin oder Sieger
                  </p>
                  <p className="heading-md text-[var(--color-ink)]">{tournament.winnerName}</p>
                </div>
              </div>
            ) : null}

            <div className="panel">
              <h2 className="meta mb-4">Auf einen Blick</h2>
              <dl className="space-y-3.5">
                {facts.map((fact) => (
                  <div key={fact.label} className="border-b border-[var(--color-line)] pb-3.5 last:border-0 last:pb-0">
                    <dt className="meta">{fact.label}</dt>
                    <dd className="mt-1 text-sm text-[var(--color-ink)]">{fact.value}</dd>
                  </div>
                ))}
                {tournament.publishedAt ? (
                  <div>
                    <dt className="meta">Veröffentlicht</dt>
                    <dd className="mt-1 text-sm text-[var(--color-ink-muted)]">
                      <time dateTime={tournament.publishedAt.toISOString()}>{formatDate(tournament.publishedAt)}</time>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {tournament.sponsors.length > 0 ? (
              <div className="panel">
                <h2 className="meta mb-4">Unterstützt von</h2>
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
