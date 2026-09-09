'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import type { NavItem } from '@/lib/content/queries';

/**
 * Mobile Navigation als vollflächiges Panel.
 *
 * Bewusst die einzige interaktive Komponente im Kopfbereich, damit auf
 * Mobilgeräten möglichst wenig JavaScript geladen wird. Vollständig per
 * Tastatur bedienbar: Escape schliesst, der Fokus bleibt im Panel und kehrt
 * beim Schliessen auf die Schaltfläche zurück.
 */

type MobileNavProps = {
  items: NavItem[];
  discordUrl: string | null;
  siteName: string;
  motto: string;
};

export function MobileNav({ items, discordUrl, siteName, motto }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Beim Seitenwechsel schliessen. Die Anpassung erfolgt beim Rendern statt in
  // einem Effekt – so entsteht kein zusätzlicher Renderdurchlauf.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }

      // Fokus im geöffneten Panel halten.
      if (event.key !== 'Tab' || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    panel?.querySelector<HTMLAnchorElement>('a')?.focus();

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
        className="btn-ghost -mr-2 min-h-11 min-w-11 p-2 md:hidden"
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
          className="fixed inset-0 z-50 flex flex-col bg-[var(--color-void)] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Hauptnavigation"
        >
          {/* Dekorative Tiefe – identisch zum Rest der Website. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid opacity-60" />
          <span
            aria-hidden="true"
            className="glow-orb glow-brand pointer-events-none -right-24 -top-24 h-72 w-72 opacity-35"
          />

          <div className="relative flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3.5">
            <Link
              href="/"
              aria-label={`${siteName} Startseite`}
              className="inline-flex min-h-11 items-center rounded-lg pr-2"
            >
              <LogoLockup size={32} />
            </Link>
            <button
              type="button"
              className="btn-ghost min-h-11 min-w-11 p-2"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
              }}
            >
              <Icons.close size={22} />
              <span className="sr-only">Menü schliessen</span>
            </button>
          </div>

          <nav className="relative flex-1 overflow-y-auto px-4 py-6" aria-label="Hauptnavigation mobil">
            <ul className="flex flex-col gap-1.5">
              {items.map((item, index) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      target={item.openInNewTab ? '_blank' : undefined}
                      rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-base font-semibold transition-colors ${
                        active
                          ? 'border-[color-mix(in_srgb,var(--color-brand)_55%,transparent)] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                          : 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] active:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <span className="meta w-6 shrink-0 text-[10px]">{String(index + 1).padStart(2, '0')}</span>
                      {item.label}
                      {active ? <span className="pulse-dot ml-auto text-[var(--color-brand-text)]" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="relative border-t border-[var(--color-line)] p-4">
            {motto ? <p className="meta-brand mb-3 text-center">«{motto}»</p> : null}
            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-lg w-full"
                data-track-social="DISCORD"
              >
                <Icons.discord size={18} />
                Discord beitreten
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
