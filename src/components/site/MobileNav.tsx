'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { ThemeToggle } from '@/components/site/ThemeToggle';
import type { NavItem } from '@/lib/content/queries';
import type { SiteLogo } from '@/lib/brandLogo';
import type { Theme } from '@/lib/theme';

/**
 * Mobile Navigation als vollflächiges Panel.
 *
 * Bewusst die einzige interaktive Komponente im Kopfbereich, damit auf
 * Mobilgeräten möglichst wenig JavaScript geladen wird. Vollständig per
 * Tastatur bedienbar: Escape schliesst, der Fokus bleibt im Panel und kehrt
 * beim Schliessen auf die Schaltfläche zurück.
 *
 * Zur Höhe: Das Panel richtet sich nach `100dvh`, also nach dem tatsächlich
 * sichtbaren Bereich. Mit `inset-0` würde es der Layout-Ansicht folgen – auf
 * Mobilgeräten ist die höher als der sichtbare Bereich, sobald die Browserleiste
 * eingeblendet ist, und der untere Teil des Menüs läge dahinter.
 */

/** Ab dieser Breite übernimmt die Navigation im Kopfbereich. */
const DESKTOP_QUERY = '(min-width: 768px)';

type MobileNavProps = {
  items: NavItem[];
  discordUrl: string | null;
  siteName: string;
  motto: string;
  theme: Theme;
  /** Gepflegtes Hauptlogo, serverseitig aufgelöst. */
  logo?: SiteLogo;
};

export function MobileNav({ items, discordUrl, siteName, motto, theme, logo }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /*
    Scrollposition im Moment des Antippens festhalten.

    Beim Öffnen wird der Body fixiert; die Höhe des Dokuments schrumpft dadurch
    im selben Bild auf die Fensterhöhe. Ein Auslesen erst im Effekt liefert
    deshalb einen bereits gekappten Wert. Der Wert aus dem Klick ist immer der,
    an dem die Besucherin oder der Besucher tatsächlich stand.
  */
  const lockedScrollY = useRef(0);

  // Beim Seitenwechsel schliessen. Die Anpassung erfolgt beim Rendern statt in
  // einem Effekt – so entsteht kein zusätzlicher Renderdurchlauf.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  /*
    Hintergrund festhalten, solange das Menü offen ist.

    `overflow: hidden` auf dem Body genügt nicht: Gescrollt wird das
    Wurzelelement, die Seite hinter dem Menü lief dadurch weiter mit. Der Body
    wird deshalb an seiner aktuellen Position fixiert; beim Schliessen wird
    genau dorthin zurückgesprungen.
  */
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const root = document.documentElement;
    const scrollY = lockedScrollY.current;
    const pathAtLock = window.location.pathname;

    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    /*
      Durch die Fixierung meldet der Browser die Position 0. Der Kopfbereich
      würde daraufhin hinter dem Menü wieder auf seine volle Höhe wachsen und
      die Seite beim Schliessen um diese acht Pixel verschieben. Dieses
      Merkmal hält die Bewegungs-Laufzeit davon ab, den Zustand zu ändern.
    */
    root.setAttribute('data-nav-open', 'true');

    return () => {
      root.removeAttribute('data-nav-open');

      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;

      // Nach einem Seitenwechsel gilt die neue Seite: Dort beginnt der Inhalt
      // oben, die alte Position darf nicht wiederhergestellt werden.
      if (window.location.pathname !== pathAtLock) return;

      // Ohne Animation zurückspringen – die Seite hat sich nicht bewegt.
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, scrollY);
      root.style.scrollBehavior = previousBehavior;
    };
  }, [open]);

  // Tastatur: Escape schliesst, der Fokus bleibt im Panel.
  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }

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
    panel?.querySelector<HTMLAnchorElement>('a')?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  /*
    Wird beim Drehen ins Querformat die Navigation im Kopfbereich sichtbar,
    verschwindet das Panel samt Schaltfläche. Es wird deshalb geschlossen,
    damit weder eine unsichtbare Ebene noch die Scrollsperre zurückbleibt.
  */
  useEffect(() => {
    if (!open) return;

    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (media.matches) setOpen(false);
    };

    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [open]);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="btn-ghost -mr-2 min-h-11 min-w-11 p-2 md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!open) lockedScrollY.current = window.scrollY;
          setOpen((value) => !value);
        }}
      >
        {open ? <Icons.close size={22} /> : <Icons.menu size={22} />}
        <span className="sr-only">{open ? 'Menü schliessen' : 'Menü öffnen'}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          /*
            `h-[100dvh]` statt `inset-0`: Das Panel ist damit genau so hoch wie
            der sichtbare Bereich und wächst bzw. schrumpft mit der
            Browserleiste. `overscroll-contain` verhindert, dass eine Wischgeste
            am Ende der Liste auf die Seite dahinter übergreift.
          */
          className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-contain bg-[var(--color-void)] md:hidden"
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

          {/* Kopfzeile: bleibt immer sichtbar, mit Abstand zur Systemleiste. */}
          <div
            className="relative flex shrink-0 items-center justify-between border-b border-[var(--color-line)] px-4 py-3.5"
            style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}
          >
            <Link
              href="/"
              aria-label={`${siteName} Startseite`}
              className="inline-flex min-h-11 items-center rounded-lg pr-2"
            >
              <LogoLockup size={32} logo={logo} name={siteName} />
            </Link>
            <div className="flex items-center gap-2">
              {/* Gleiche Umschaltung wie im Kopfbereich – im Menü mit
                  Beschriftung, weil hier Platz dafür ist. */}
              <ThemeToggle initial={theme} withLabel />
              <button type="button" className="btn-ghost min-h-11 min-w-11 p-2" onClick={close}>
                <Icons.close size={22} />
                <span className="sr-only">Menü schliessen</span>
              </button>
            </div>
          </div>

          {/* Reicht die Höhe nicht, wird ausschliesslich dieser Bereich gescrollt. */}
          <nav
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"
            aria-label="Hauptnavigation mobil"
          >
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
                      onClick={() => setOpen(false)}
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

          {/* Fusszeile: bleibt sichtbar, mit Abstand zur Systemleiste. */}
          <div
            className="relative shrink-0 border-t border-[var(--color-line)] px-4 pt-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {motto ? <p className="meta-brand mb-3 text-center">«{motto}»</p> : null}
            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-lg w-full"
                data-track-social="DISCORD"
                onClick={() => setOpen(false)}
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
