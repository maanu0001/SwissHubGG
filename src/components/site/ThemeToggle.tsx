'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Icons } from '@/components/ui/Icon';
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  isTheme,
  otherTheme,
  themeToggleLabel,
  type Theme,
} from '@/lib/theme';

/**
 * Umschaltung zwischen dunkler und heller Darstellung.
 *
 * Die aktuelle Wahl kommt vom Server (`initial`), damit die Schaltfläche schon
 * beim ersten Zeichnen den richtigen Zustand zeigt und die Hydration nicht
 * abweicht. Umgeschaltet wird ausschliesslich im Browser: Das Merkmal am
 * `<html>`-Element wechselt sofort, das Cookie hält die Wahl für spätere
 * Aufrufe fest. Es gibt keinen Neuaufbau der Seite und damit auch keinen
 * Sprung im Layout – die gesamte Darstellung hängt an CSS-Merkmalen.
 *
 * Die beiden Symbole liegen übereinander; sichtbar ist immer das Ziel der
 * Umschaltung. Beschriftung und `aria-pressed` benennen dasselbe.
 */

type ThemeToggleProps = {
  initial: Theme;
  /** Zusätzliche Klassen für die Einbettung in Kopf- oder Navigationsleisten. */
  className?: string;
  /** Beschriftung neben dem Symbol – für breite Menüs statt eines reinen Symbols. */
  withLabel?: boolean;
};

/**
 * Massgeblich ist immer das Merkmal am `<html>`-Element, nicht ein eigener
 * Zustand je Schaltfläche. Dadurch zeigen alle Schaltflächen – Kopfbereich,
 * mobiles Menü, Dashboard – ohne weiteres Zutun dasselbe an.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export function ThemeToggle({ initial, className = '', withLabel = false }: ThemeToggleProps) {
  const getSnapshot = useCallback((): Theme => {
    const current = document.documentElement.dataset.theme;
    return isTheme(current) ? current : initial;
  }, [initial]);

  // Auf dem Server und bei der Hydration gilt der vom Layout gelesene Wert –
  // Server- und Client-Ausgabe stimmen dadurch immer überein.
  const getServerSnapshot = useCallback((): Theme => initial, [initial]);

  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const next = otherTheme(theme);
  const label = themeToggleLabel(theme);

  const apply = () => {
    const root = document.documentElement;
    root.dataset.theme = next;
    root.style.colorScheme = next;

    /*
      `SameSite=Lax` genügt: Der Wert steuert nur die Darstellung und ist keine
      Berechtigung. `Secure` wird nur über HTTPS gesetzt, damit die Wahl auch
      bei einer lokalen Entwicklungsumgebung erhalten bleibt.
    */
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  };

  return (
    <button
      type="button"
      onClick={apply}
      title={label}
      aria-label={label}
      aria-pressed={theme === 'light'}
      data-theme-toggle
      className={`theme-toggle ${className}`}
    >
      <span aria-hidden="true" className="theme-toggle-icons">
        <Icons.sun size={17} className="theme-toggle-sun" />
        <Icons.moon size={17} className="theme-toggle-moon" />
      </span>
      {withLabel ? <span className="theme-toggle-label">{theme === 'dark' ? 'Hell' : 'Dunkel'}</span> : null}
      {/* Für Screenreader ändert sich der Text mit dem Zustand. */}
      <span className="sr-only" aria-live="polite">
        {theme === 'dark' ? 'Dunkles Design ist aktiv.' : 'Helles Design ist aktiv.'}
      </span>
    </button>
  );
}
