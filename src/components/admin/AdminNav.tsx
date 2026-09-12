'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/site/ThemeToggle';
import type { Theme } from '@/lib/theme';

/**
 * Navigation des Admin-Dashboards.
 *
 * Es werden nur Bereiche angezeigt, für die tatsächlich eine Berechtigung
 * vorliegt. Die serverseitige Prüfung erfolgt zusätzlich in jeder Route.
 */

export type AdminNavGroup = {
  label: string;
  items: { href: string; label: string; badge?: number }[];
};

type AdminNavProps = {
  groups: AdminNavGroup[];
  user: { displayName: string; roles: string[]; isSuperAdmin: boolean };
  logout: React.ReactNode;
  theme: Theme;
};

export function AdminNav({ groups, user, logout, theme }: AdminNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

  const navigation = (
    <nav aria-label="Dashboard-Navigation" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      {groups.map((group) => (
        <div key={group.label}>
          <h2 className="meta mb-2 px-3">{group.label}</h2>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center justify-between gap-2 rounded-lg py-2 pl-4 pr-3 text-sm transition-colors ${
                      active
                        ? 'bg-[var(--color-brand-soft)] font-semibold text-[var(--color-brand-text)]'
                        : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--color-brand-bright)]"
                      />
                    ) : null}
                    <span>{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 ? (
                      <span className="rounded-full bg-[var(--color-brand)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-brand-contrast)]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-[var(--color-line)] p-3">
      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] p-3">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">{user.displayName}</p>
        <p className="meta mt-1 truncate">
          {user.isSuperAdmin ? 'Superadmin' : user.roles.length > 0 ? user.roles.join(', ') : 'Keine Rolle'}
        </p>
      </div>
      {/* Darstellung umschalten – an derselben, immer erreichbaren Stelle wie
          Abmelden, in der Seitenleiste wie in der mobilen Navigation. */}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-1.5">
        <span className="text-sm text-[var(--color-ink-muted)]">Darstellung</span>
        <ThemeToggle initial={theme} />
      </div>

      <div className="mt-1 flex flex-col gap-1">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]"
        >
          <Icons.external size={14} />
          Website ansehen
        </Link>
        {logout}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Kopfzeile */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-void)] px-4 py-3 lg:hidden">
        <Link href="/admin">
          <LogoLockup size={30} suffix="Admin" />
        </Link>
        <button
          type="button"
          className="btn-ghost p-2"
          aria-expanded={open}
          aria-controls="admin-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <Icons.close size={22} /> : <Icons.menu size={22} />}
          <span className="sr-only">{open ? 'Navigation schliessen' : 'Navigation öffnen'}</span>
        </button>
      </div>

      {open ? (
        <div
          id="admin-navigation"
          className="flex flex-col border-b border-[var(--color-line)] bg-[var(--color-void)] lg:hidden"
        >
          {navigation}
          {footer}
        </div>
      ) : null}

      {/* Seitenleiste ab Desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-void)] lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="border-b border-[var(--color-line)] px-5 py-4">
          <Link href="/admin">
            <LogoLockup size={32} suffix="Admin" />
          </Link>
        </div>
        {navigation}
        {footer}
      </aside>
    </>
  );
}
