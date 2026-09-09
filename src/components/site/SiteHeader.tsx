import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { MobileNav } from '@/components/site/MobileNav';
import { NavLink } from '@/components/site/NavLink';
import { getNavigation } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { safeUrl } from '@/lib/sanitize';

/**
 * Kopfbereich der Website.
 *
 * Startet transparent über dem Hero und wird beim Scrollen kompakter, dunkler
 * und klar abgegrenzt. Der Zustandswechsel läuft über das Attribut
 * `data-scrolled` am Wurzelelement, das die zentrale Bewegungs-Laufzeit setzt –
 * dadurch bleibt der Kopfbereich vollständig serverseitig gerendert.
 *
 * Interaktiv ist nur die mobile Navigation.
 */
export async function SiteHeader() {
  const [items, settings] = await Promise.all([getNavigation('main'), getSettings()]);
  const discordUrl = safeUrl(settings.discordInviteUrl);

  return (
    <header className="header-shell sticky top-0 z-40">
      {/* Feine Markenkante, die erst beim Scrollen sichtbar wird. */}
      <span aria-hidden="true" className="hairline-brand header-edge absolute inset-x-0 bottom-0" />

      <div className="shell header-bar flex items-center justify-between gap-4">
        <Link
          href="/"
          className="group shrink-0 rounded-lg"
          aria-label={`${settings.siteName} Startseite`}
        >
          <LogoLockup size={36} priority interactive />
        </Link>

        <nav className="hidden md:block" aria-label="Hauptnavigation">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <NavLink
                  href={item.href}
                  label={item.label}
                  openInNewTab={item.openInNewTab}
                  highlight={item.highlight}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {discordUrl ? (
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary hidden sm:inline-flex"
              data-track-social="DISCORD"
            >
              <Icons.discord size={17} />
              Discord beitreten
            </a>
          ) : null}
          <MobileNav items={items} discordUrl={discordUrl} siteName={settings.siteName} motto={settings.motto} />
        </div>
      </div>
    </header>
  );
}
