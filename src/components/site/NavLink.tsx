'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navigationslink mit animiertem aktivem Zustand.
 *
 * Der aktive Zustand wird zusätzlich über `aria-current` ausgezeichnet – die
 * Information hängt damit nicht allein an Farbe oder Bewegung.
 */
type NavLinkProps = {
  href: string;
  label: string;
  openInNewTab?: boolean;
  highlight?: boolean;
};

export function NavLink({ href, label, openInNewTab = false, highlight = false }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
        active
          ? 'text-[var(--color-ink)]'
          : highlight
            ? 'text-[var(--color-brand-text)] hover:text-[var(--color-ink)]'
            : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
      }`}
    >
      {/* Ruhige Hintergrundfläche beim Überfahren */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg bg-[var(--color-surface-raised)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      <span className="relative">{label}</span>

      {/* Aktivmarke: fährt beim Wechsel weich auf */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-3 -bottom-px h-0.5 origin-center rounded-full bg-[var(--color-brand-bright)] transition-transform duration-300 ease-[var(--ease-out-soft)] ${
          active ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </Link>
  );
}
