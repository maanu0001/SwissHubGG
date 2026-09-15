import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { getNavigation, getSocialAccounts, getSponsors, getSponsorsByIds } from '@/lib/content/queries';
import { SponsorLogo } from '@/components/site/SponsorCard';
import { getSettings } from '@/lib/settings';
import { getSiteLogo } from '@/lib/siteLogo';
import { safeUrl } from '@/lib/sanitize';
import { SOCIAL_PLATFORM_META } from '@/components/site/socialMeta';

/**
 * Fussbereich mit Markenblock, gepflegter Navigation, Social-Profilen und
 * rechtlichen Hinweisen. Alle Inhalte stammen aus dem CMS bzw. den globalen
 * Einstellungen – es gibt keine fest verdrahteten Platzhalter.
 *
 * Der Abschluss ist bewusst kompakt gehalten: kein Linkteppich, sondern drei
 * klare Spalten und ein ruhiger technischer Hintergrund.
 */
const LEGAL_HREFS = ['/impressum', '/datenschutz', '/nutzungsbedingungen', '/cookies'];

export async function SiteFooter() {
  const settings = await getSettings();

  const [footerItems, accounts, sponsors, logo, footerSponsors] = await Promise.all([
    getNavigation('footer'),
    getSocialAccounts(),
    getSponsors('ACTIVE', 12),
    getSiteLogo(),
    /*
      Der im Dashboard gewählte Partner. Die Abfrage lässt ausschliesslich
      veröffentlichte, nicht archivierte Partner durch – ein zurückgezogener
      Partner verschwindet dadurch von selbst aus dem Fussbereich, ohne dass
      die Einstellung angefasst werden muss.
    */
    settings.footerSponsorId ? getSponsorsByIds([settings.footerSponsorId]) : Promise.resolve([]),
  ]);

  const footerSponsor = footerSponsors[0] ?? null;

  const discordUrl = safeUrl(settings.discordInviteUrl);
  const year = new Date().getFullYear();
  const hostingPartner = sponsors.find((sponsor) => sponsor.tier?.key === 'hosting');

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-[var(--color-line)] bg-[var(--color-void)]">
      {/* Dezente technische Grafik als Abschluss der Seite. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-50" />
      <span
        aria-hidden="true"
        className="glow-orb glow-brand pointer-events-none -left-32 -top-40 h-[26rem] w-[26rem] opacity-20"
      />

      <div className="shell relative py-14 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:gap-14">
          <div>
            <LogoLockup size={40} logo={logo} name={settings.siteName} />

            {settings.motto ? (
              <p className="mt-5 flex items-center gap-2.5 text-base font-semibold text-[var(--color-brand-text)]">
                <span aria-hidden="true" className="h-px w-6 bg-[var(--color-brand)]" />
                «{settings.motto}»
              </p>
            ) : null}

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {settings.footerText}
            </p>

            {accounts.length > 0 ? (
              <ul className="mt-7 flex flex-wrap gap-2">
                {accounts.map((account) => {
                  const meta = SOCIAL_PLATFORM_META[account.platform];
                  const PlatformIcon = meta.icon;
                  const url = safeUrl(account.profileUrl);
                  if (!url) return null;

                  return (
                    <li key={account.id}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-track-social={account.platform}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] transition-[color,border-color,transform,background-color] duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--color-brand)_50%,transparent)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-brand-text)]"
                      >
                        <PlatformIcon size={18} />
                        <span className="sr-only">
                          {meta.label}: {account.handle}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className="meta mb-5">
              Community
            </h2>
            <ul className="space-y-3">
              {footerItems
                .filter((item) => !LEGAL_HREFS.includes(item.href))
                .map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                      className="group inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                    >
                      <span
                        aria-hidden="true"
                        className="h-px w-0 bg-[var(--color-brand)] transition-[width] duration-300 ease-[var(--ease-out-soft)] group-hover:w-3"
                      />
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div>
            <h2 className="meta mb-5">Kontakt &amp; Rechtliches</h2>
            <ul className="space-y-3">
              {settings.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    <Icons.mail size={14} className="text-[var(--color-ink-subtle)]" />
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              <li>
                <Link
                  href="/kontakt"
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  Kontaktformular
                </Link>
              </li>
              <li>
                <Link
                  href="/impressum"
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  Impressum
                </Link>
              </li>
              <li>
                <Link
                  href="/datenschutz"
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  Cookies
                </Link>
              </li>
            </ul>

            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-track-social="DISCORD"
                className="btn-primary mt-7 w-full sm:w-auto"
              >
                <Icons.discord size={17} />
                Discord beitreten
              </a>
            ) : null}
          </div>
        </div>

        {/* Ohne Auswahl entfällt der Bereich vollständig – kein leerer Platz. */}
        {footerSponsor ? (
          <div className="mt-12">
            <span aria-hidden="true" className="hairline block" />
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="meta">{settings.sponsorSectionLabel}</p>

              <Link
                href={`/partner/${footerSponsor.slug}`}
                className="group inline-flex items-center gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--color-brand)_45%,var(--color-line))] hover:bg-[var(--color-surface-hover)]"
              >
                <span className="flex h-10 items-center">
                  <SponsorLogo sponsor={footerSponsor} className="max-h-10" />
                </span>
                {/* Ohne hinterlegtes Logo zeigt die Logofläche bereits den Namen –
                    dann entfällt die zweite Nennung. */}
                {footerSponsor.logo ? (
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{footerSponsor.name}</span>
                ) : null}
                <Icons.arrowRight
                  size={14}
                  className="text-[var(--color-brand-text)] transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-12">
          <span aria-hidden="true" className="hairline block" />
          <div className="mt-6 flex flex-col gap-3 text-xs text-[var(--color-ink-subtle)] sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {settings.legalEntityName || 'SwissHub'}. Alle Rechte vorbehalten.
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {hostingPartner ? (
                <p>
                  Hosting-Partner:{' '}
                  {safeUrl(hostingPartner.websiteUrl) ? (
                    <a
                      href={safeUrl(hostingPartner.websiteUrl) as string}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      data-track-sponsor={hostingPartner.slug}
                      className="text-[var(--color-ink-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                    >
                      {hostingPartner.name}
                    </a>
                  ) : (
                    <span className="text-[var(--color-ink-muted)]">{hostingPartner.name}</span>
                  )}
                </p>
              ) : null}
              {settings.footerNote ? <p>{settings.footerNote}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
