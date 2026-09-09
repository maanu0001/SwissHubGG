'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import type { NavItem } from '@/lib/content/queries';

/**
 * Mobile Navigation.
 *
 * Bewusst die einzige interaktive Komponente im Kopfbereich, damit auf
 * Mobilgeräten möglichst wenig JavaScript geladen wird. Vollständig per
 * Tastatur bedienbar, mit Fokusrückgabe und Escape zum Schliessen.
 */

type MobileNavProps = {
  items: NavItem[];
  discordUrl: string | null;
};

export function MobileNav({ items, discordUrl }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Beim Seitenwechsel schliessen.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="btn-ghost -mr-2 p-2 md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <Icons.close size={22} /> : <Icons.menu size={22} />}
        <span className="sr-only">{open ? 'Menü schliessen' : 'Menü öffnen'}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--color-base)] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Hauptnavigation"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
            <Link href="/" aria-label="SwissHub Startseite">
              <LogoLockup size={32} />
            </Link>
            <button
              type="button"
              className="btn-ghost p-2"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
            >
              <Icons.close size={22} />
              <span className="sr-only">Menü schliessen</span>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Hauptnavigation mobil">
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                        active
                          ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                          : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-raised)]'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {discordUrl ? (
            <div className="border-t border-[var(--color-line)] p-4">
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full"
                data-track-social="DISCORD"
              >
                <Icons.discord size={18} />
                Discord beitreten
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
