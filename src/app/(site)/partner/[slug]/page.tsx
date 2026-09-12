import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SponsorLogo } from '@/components/site/SponsorCard';
import { JsonLd } from '@/components/site/JsonLd';
import { PageHero } from '@/components/site/PageHero';
import { Icons } from '@/components/ui/Icon';
import { Reveal, revealProps } from '@/components/visual/Reveal';
import { getSponsorBySlug } from '@/lib/content/queries';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { getSettings } from '@/lib/settings';
import { formatDate, formatDateRange } from '@/lib/format';
import { renderRichText, safeUrl } from '@/lib/sanitize';

/**
 * Detailseite eines Partners.
 *
 * Zeigt ausschliesslich gepflegte Angaben – fehlt eine, entfällt der Abschnitt
 * ersatzlos. Nicht veröffentlichte und archivierte Partner sind hier ebenso
 * wenig erreichbar wie in der Übersicht; sie beantworten den Aufruf mit 404.
 */

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sponsor = await getSponsorBySlug(slug);

  if (!sponsor) {
    return { title: 'Partner nicht gefunden', robots: { index: false, follow: false } };
  }

  return buildMetadata({
    title: sponsor.name,
    description: sponsor.shortDescription ?? sponsor.description,
    path: `/partner/${slug}`,
    imageKey: sponsor.logo?.storageKey ?? null,
    type: 'article',
  });
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const sponsor = await getSponsorBySlug(slug);

  if (!sponsor) notFound();

  const settings = await getSettings();
  const website = safeUrl(sponsor.websiteUrl);
  const isFormer = sponsor.status === 'FORMER';
  const description = sponsor.description ? renderRichText(sponsor.description) : '';

  const details = [
    sponsor.tier ? { label: 'Stufe', value: sponsor.tier.name } : null,
    sponsor.partnerSince || sponsor.partnerUntil
      ? { label: 'Partnerschaft', value: formatDateRange(sponsor.partnerSince, sponsor.partnerUntil) }
      : null,
    { label: 'Status', value: isFormer ? 'Ehemaliger Partner' : 'Aktiver Partner' },
  ].filter((entry): entry is { label: string; value: string } => entry !== null);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Start', path: '/' },
          { name: settings.sponsorSectionLabel, path: '/partner' },
          { name: sponsor.name, path: `/partner/${slug}` },
        ])}
      />

      <PageHero
        eyebrow={settings.sponsorSectionLabel}
        icon="shield"
        ghost="Partner"
        title={sponsor.name}
        lead={sponsor.shortDescription ?? undefined}
      >
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/partner" className="btn-secondary">
            <Icons.arrowRight size={14} className="rotate-180" />
            Alle Partner
          </Link>

          {website ? (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer sponsored"
              data-track-sponsor={sponsor.slug}
              className="btn-primary"
            >
              Website besuchen
              <Icons.external size={13} />
              <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
          ) : null}
        </div>
      </PageHero>

      <div className="shell section grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-8">
          <Reveal variant="scale">
            {/* Das Logo wird eingepasst, nie verzerrt, beschnitten oder eingefärbt. */}
            <div className="relative flex h-40 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-void)] px-8">
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] tech-grid-fine opacity-50" />
              <span className="relative">
                <SponsorLogo sponsor={sponsor} className="max-h-24" />
              </span>
            </div>
          </Reveal>

          {description ? (
            <Reveal index={1}>
              {/* Der Text entsteht serverseitig aus Markdown und ist streng gefiltert. */}
              <div className="prose-swisshub" dangerouslySetInnerHTML={{ __html: description }} />
            </Reveal>
          ) : null}

          {sponsor.tournaments.length > 0 ? (
            <Reveal index={2}>
              <section aria-labelledby="turniere">
                <h2 id="turniere" className="heading-md mb-4">
                  Unterstützte Turniere
                </h2>
                <ul className="space-y-2">
                  {sponsor.tournaments.map((entry, index) => (
                    <li key={entry.tournament.slug} {...revealProps('up', index, 60)}>
                      <Link
                        href={`/turniere/${entry.tournament.slug}`}
                        className="card-interactive flex items-center justify-between gap-4 px-4 py-3 text-sm"
                      >
                        <span className="font-medium text-[var(--color-ink)]">{entry.tournament.title}</span>
                        {entry.tournament.startsAt ? (
                          <span className="meta shrink-0">{formatDate(entry.tournament.startsAt)}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}
        </div>

        <Reveal variant="right" className="panel corner-ticks relative overflow-hidden lg:sticky lg:top-24">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-40" />
          <div className="relative">
            <p className="meta-brand mb-4">Partnerschaft</p>

            <dl className="space-y-3 text-sm">
              {details.map((entry) => (
                <div key={entry.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] pb-3 last:border-0 last:pb-0">
                  <dt className="text-[var(--color-ink-subtle)]">{entry.label}</dt>
                  <dd className="text-right font-medium text-[var(--color-ink)]">{entry.value}</dd>
                </div>
              ))}
            </dl>

            {website ? (
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer sponsored"
                data-track-sponsor={sponsor.slug}
                className="link-arrow mt-5 inline-flex"
              >
                {new URL(website).host}
                <Icons.external size={13} />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            ) : null}
          </div>
        </Reveal>
      </div>
    </>
  );
}
