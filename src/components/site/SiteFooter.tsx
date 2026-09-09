import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { getNavigation, getSocialAccounts, getSponsors } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { safeUrl } from '@/lib/sanitize';
import { SOCIAL_PLATFORM_META } from '@/components/site/socialMeta';

/**
 * Fussbereich mit Markenblock, gepflegter Navigation, Social-Profilen und
 * rechtlichen Hinweisen. Alle Inhalte stammen aus dem CMS bzw. den globalen
 * Einstellungen – es gibt keine fest verdrahteten Platzhalter.
 */
export async function SiteFooter() {
  const [settings, footerItems, accounts, sponsors] = await Promise.all([
    getSettings(),
    getNavigation('footer'),
    getSocialAccounts(),
    getSponsors('ACTIVE', 12),
  ]);

  const discordUrl = safeUrl(settings.discordInviteUrl);
  const year = new Date().getFullYear();
  const hostingPartner = sponsors.find((sponsor) => sponsor.tier?.key === 'hosting');

  return (
    <footer className="mt-auto border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="shell py-12">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div>
            <LogoLockup size={36} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {settings.footerText}
            </p>
            {settings.motto ? (
              <p className="mt-3 text-sm font-semibold text-[var(--color-brand-text)]">«{settings.motto}»</p>
            ) : null}

            {accounts.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
                      >
                        <PlatformIcon size={18} />
                        <span className="sr-only">{meta.label}: {account.handle}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className="mb-4 text-sm font-semibold text-[var(--color-ink)]">
              Community
            </h2>
            <ul className="space-y-2.5">
              {footerItems
                .filter((item) => !['/impressum', '/datenschutz', '/nutzungsbedingungen'].includes(item.href))
                .map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                      className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>

          <div>
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">Kontakt & Rechtliches</h2>
            <ul className="space-y-2.5">
              {settings.contactEmail ? (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    {settings.contactEmail}
                  </a>
                </li>
              ) : null}
              <li>
                <Link href="/kontakt" className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]">
                  Kontaktformular
                </Link>
              </li>
              <li>
                <Link href="/impressum" className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]">
                  Impressum
                </Link>
              </li>
              <li>
                <Link href="/datenschutz" className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]">
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-sm text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]">
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
                className="btn-secondary mt-6 w-full sm:w-auto"
              >
                <Icons.discord size={17} />
                Discord beitreten
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {settings.legalEntityName || 'SwissHub'}. Alle Rechte vorbehalten.</p>

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
    </footer>
  );
}
