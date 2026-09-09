import type { Metadata } from 'next';
import Link from 'next/link';
import { SponsorCard } from '@/components/site/SponsorCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { PageHero } from '@/components/site/PageHero';
import { Reveal, revealProps } from '@/components/visual/Reveal';
import { getSponsors } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

/**
 * Öffentliche Partner- und Sponsorenübersicht.
 *
 * Bewusst der ruhigste Bereich der Website: viel Weissraum, keine
 * spielerischen Effekte, klare Stufen. Aktive und ehemalige Partner sind
 * deutlich getrennt gekennzeichnet.
 */

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return buildMetadata({
    title: `${settings.sponsorSectionLabel} von SwissHub`,
    description:
      'Partner und Sponsoren der Schweizer Gaming-Community SwissHub – Unternehmen und Organisationen, die Turniere, Events und die Community unterstützen.',
    path: '/partner',
  });
}

export default async function PartnerPage() {
  const [settings, active, former] = await Promise.all([
    getSettings(),
    getSponsors('ACTIVE', 60),
    getSponsors('FORMER', 30),
  ]);

  const grouped = settings.showSponsorTiers
    ? [...active].sort((a, b) => (a.tier?.sortOrder ?? 999) - (b.tier?.sortOrder ?? 999) || a.sortOrder - b.sortOrder)
    : active;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Start', path: '/' },
          { name: settings.sponsorSectionLabel, path: '/partner' },
        ])}
      />

      <PageHero
        eyebrow={settings.sponsorSectionLabel}
        icon="shield"
        title="Gemeinsam mit starken Partnern"
        lead="Turniere, Events und der Betrieb unserer Infrastruktur sind nur möglich, weil uns Partner unterstützen. Hier stellen wir sie vor."
      />

      <div className="shell section space-y-16 sm:space-y-20">
        <section aria-labelledby="aktive-partner">
          <Reveal>
            <h2 id="aktive-partner" className="heading-lg mb-8">
              Aktuelle Partner
            </h2>
          </Reveal>

          {grouped.length === 0 ? (
            <EmptyState
              icon="shield"
              title="Aktuell sind keine Partner veröffentlicht"
              description="Sobald eine Partnerschaft bestätigt und freigegeben ist, stellen wir sie hier vor."
              action={{ href: '/kontakt?kategorie=sponsoring', label: 'Sponsoring anfragen' }}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.map((sponsor, index) => (
                <li key={sponsor.id} {...revealProps('up', index)}>
                  <SponsorCard sponsor={sponsor} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {former.length > 0 ? (
          <section aria-labelledby="ehemalige-partner">
            <Reveal>
              <h2 id="ehemalige-partner" className="heading-lg mb-3">
                Ehemalige Partner
              </h2>
              <p className="lead mb-8">Diesen Partnern danken wir für die Unterstützung in der Vergangenheit.</p>
            </Reveal>

            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {former.map((sponsor, index) => (
                <li key={sponsor.id} {...revealProps('up', index)}>
                  <SponsorCard sponsor={sponsor} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Reveal variant="scale">
          <section className="relative isolate overflow-hidden rounded-[var(--radius-panel)] border border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] bg-[var(--color-brand-soft)] p-8 sm:p-14">
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-45" />
            <span
              aria-hidden="true"
              data-ambient
              className="glow-orb glow-brand drift-slow pointer-events-none -right-24 -top-24 h-[24rem] w-[24rem] opacity-30"
            />

            <div className="relative max-w-2xl">
              <p className="meta-brand mb-4">Zusammenarbeit</p>
              <h2 className="display-2">Partner werden</h2>
              <p className="lead mt-4">
                Du möchtest eine Schweizer Gaming-Community erreichen und Turniere oder Events unterstützen? Erzähl uns
                von deiner Idee – wir melden uns mit einem passenden Vorschlag.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/kontakt?kategorie=sponsoring" className="btn-primary btn-lg">
                  Sponsoring anfragen
                  <Icons.arrowRight size={15} />
                </Link>
                <Link href="/kontakt?kategorie=partnerschaft" className="btn-secondary btn-lg">
                  Kooperation vorschlagen
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}
