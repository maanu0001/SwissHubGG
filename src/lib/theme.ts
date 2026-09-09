/**
 * Farbdarstellung der Website (dunkel oder hell).
 *
 * Grundsätze:
 *
 * - **Dunkel ist der Standard.** Das ist die gestalterische Grundlage von
 *   SwissHub, nicht eine Ableitung aus der Systemeinstellung des Geräts.
 *   `prefers-color-scheme` wird für die Wahl bewusst *nicht* ausgewertet: Ein
 *   hell eingestelltes Betriebssystem darf die Website nicht umstellen.
 * - **Die Wahl gehört der Besucherin oder dem Besucher.** Sie liegt in einem
 *   eigenen Cookie im Browser, nicht in den Website-Einstellungen. Niemand
 *   ändert damit die Darstellung für andere.
 * - **Sie wird auf dem Server gelesen.** Das `<html>`-Element trägt das
 *   Merkmal schon in der ausgelieferten Antwort. Dadurch gibt es weder ein
 *   Aufblitzen der falschen Darstellung noch einen Unterschied zwischen
 *   Server- und Client-Ausgabe.
 *
 * Das Cookie enthält ausschliesslich `dark` oder `light` – keine
 * personenbezogene Angabe. Es ist deshalb bewusst nicht `httpOnly`: die
 * Umschaltung setzt es unmittelbar im Browser, ohne Anfrage an den Server.
 */

export const THEME_COOKIE = 'swisshub_theme';

/** Ein Jahr – die Wahl soll auch nach Wochen noch gelten. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

/** Ohne gespeicherte Wahl gilt immer die dunkle Darstellung. */
export const DEFAULT_THEME: Theme = 'dark';

export function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/** Wandelt einen beliebigen Cookie-Wert in eine gültige Darstellung um. */
export function resolveTheme(value: string | undefined | null): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** Beschriftung der Umschaltfläche – benennt immer das Ziel, nicht den Zustand. */
export function themeToggleLabel(current: Theme): string {
  return current === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren';
}

/**
 * Der Wert für `color-scheme`. Damit stellt der Browser Bildlaufleisten,
 * Formularfelder und seine eigene Oberfläche passend dar.
 */
export function colorSchemeOf(theme: Theme): 'dark' | 'light' {
  return theme;
}

/** Farbe der Browserleiste auf Mobilgeräten. Entspricht dem Seitengrund. */
export function themeColorOf(theme: Theme): string {
  return theme === 'dark' ? '#0a0b10' : '#f2f3f6';
}
