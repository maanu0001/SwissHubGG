import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { MobileNav } from '@/components/site/MobileNav';
import { NavLink } from '@/components/site/NavLink';
import { getNavigation } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { safeUrl } from '@/lib/sanitize';

/**
 * Sticky Kopfbereich mit leichter Transparenz, Blur und dezenter Abgrenzung.
 * Rendert serverseitig; nur die mobile Navigation ist interaktiv.
 */
export async function SiteHeader() {
  const [items, settings] = await Promise.all([getNavigation('main'), getSettings()]);
  const discordUrl = safeUrl(settings.discordInviteUrl);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-canvas)_82%,transparent)] backdrop-blur-md">
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="SwissHub Startseite">
          <LogoLockup size={34} priority />
        </Link>

        <nav className="hidden md:block" aria-label="Hauptnavigation">
          <ul className="flex items-center gap-1">
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
          <MobileNav items={items} discordUrl={discordUrl} />
        </div>
      </div>
    </header>
  );
}
