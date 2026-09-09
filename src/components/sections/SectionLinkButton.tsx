import Link from 'next/link';
import { Icons } from '@/components/ui/Icon';
import type { SectionLink } from '@/lib/content/sections';
import { safeUrl } from '@/lib/sanitize';
import { getSettings } from '@/lib/settings';

/**
 * Eine im Website-Builder gepflegte Schaltfläche.
 *
 * Liegt bewusst in einer eigenen Datei, weil sie sowohl in den Inhaltsblöcken
 * als auch im gemeinsamen Kopfbereich der CMS-Seiten gebraucht wird.
 */

/**
 * Platzhalter, der auf den in den Einstellungen gepflegten Discord-Link
 * verweist. So bleibt der Einladungslink an einer einzigen Stelle pflegbar.
 * Ist er nicht gesetzt, wird die Schaltfläche ausgelassen statt ins Leere zu
 * führen.
 */
export const DISCORD_TOKEN = '{discord}';

export async function SectionLinkButton({
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
