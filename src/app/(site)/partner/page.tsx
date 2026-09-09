import type { Metadata } from 'next';
import Link from 'next/link';
import { SponsorCard } from '@/components/site/SponsorCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { getSponsors } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

/**
 * Öffentliche Partner- und Sponsorenübersicht.
 * Aktive und ehemalige Partner sind klar getrennt gekennzeichnet.
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
      <JsonLd data={breadcrumbJsonLd([{ name: 'Start', path: '/' }, { name: settings.sponsorSectionLabel, path: '/partner' }])} />

      <section className="border-b border-[var(--color-line)] hero-veil">
        <div className="shell py-14 sm:py-20">
          <p className="eyebrow">
            <Icons.shield size={14} />
            {settings.sponsorSectionLabel}
          </p>
          <h1 className="heading-xl max-w-2xl">Gemeinsam mit starken Partnern</h1>
          <p className="lead mt-4 max-w-2xl">
            Turniere, Events und der Betrieb unserer Infrastruktur sind nur möglich, weil uns Partner unterstützen.
            Hier stellen wir sie vor.
          </p>
        </div>
      </section>

      <div className="shell section space-y-14">
        <section aria-labelledby="aktive-partner">
          <h2 id="aktive-partner" className="heading-lg mb-6">Aktuelle Partner</h2>

          {grouped.length === 0 ? (
            <EmptyState
              title="Aktuell sind keine Partner veröffentlicht"
              description="Sobald eine Partnerschaft bestätigt und freigegeben ist, stellen wir sie hier vor."
              action={{ href: '/kontakt?kategorie=sponsoring', label: 'Sponsoring anfragen' }}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.map((sponsor) => (
                <li key={sponsor.id}>
                  <SponsorCard sponsor={sponsor} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {former.length > 0 ? (
          <section aria-labelledby="ehemalige-partner">
            <h2 id="ehemalige-partner" className="heading-lg mb-2">Ehemalige Partner</h2>
            <p className="lead mb-6 max-w-2xl">
              Diesen Partnern danken wir für die Unterstützung in der Vergangenheit.
            </p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {former.map((sponsor) => (
                <li key={sponsor.id}>
                  <SponsorCard sponsor={sponsor} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--color-brand)_55%,transparent)] bg-[var(--color-brand-soft)] p-8 sm:p-12">
          <h2 className="heading-lg">Partner werden</h2>
          <p className="lead mt-3 max-w-2xl">
            Du möchtest eine Schweizer Gaming-Community erreichen und Turniere oder Events unterstützen? Erzähl uns von
            deiner Idee – wir melden uns mit einem passenden Vorschlag.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/kontakt?kategorie=sponsoring" className="btn-primary">
              Sponsoring anfragen
            </Link>
            <Link href="/kontakt?kategorie=partnerschaft" className="btn-secondary">
              Kooperation vorschlagen
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
