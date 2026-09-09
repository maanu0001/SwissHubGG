'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navigationslink, der den aktiven Zustand kennt.
 * Der aktive Zustand wird zusätzlich über `aria-current` ausgezeichnet – die
 * Information hängt damit nicht allein an der Farbe.
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
      className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'text-[var(--color-ink)] after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-[var(--color-brand)]'
          : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
      } ${highlight ? 'text-[var(--color-brand-text)]' : ''}`}
    >
      {label}
    </Link>
  );
}
