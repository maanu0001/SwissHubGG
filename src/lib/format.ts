/**
 * Einheitliche Formatierung für die Schweiz (de-CH, Europe/Zurich).
 * Wird auf Server und Client identisch verwendet, damit keine
 * Hydrationsunterschiede entstehen.
 */

export const LOCALE = 'de-CH';
export const TIME_ZONE = 'Europe/Zurich';

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '–';
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '–';
  return `${dateTimeFormatter.format(new Date(value))} Uhr`;
}

export function formatLongDate(value: Date | string | null | undefined): string {
  if (!value) return '–';
  return longDateFormatter.format(new Date(value));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return numberFormatter.format(value);
}

/** Zeitraum kompakt darstellen, z. B. „12.04.2026 – 14.04.2026“. */
export function formatDateRange(from: Date | string | null, to: Date | string | null): string {
  if (!from && !to) return '–';
  if (from && !to) return `ab ${formatDate(from)}`;
  if (!from && to) return `bis ${formatDate(to)}`;
  const start = formatDate(from);
  const end = formatDate(to);
  return start === end ? start : `${start} – ${end}`;
}

const dayInZoneFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalendertag in Schweizer Zeit als UTC-Mitternacht – Basis für Tagesdifferenzen. */
function zonedDayStart(value: Date): number {
  return Date.parse(`${dayInZoneFormatter.format(value)}T00:00:00Z`);
}

/**
 * Ganze Tage bis zu einem Termin, gerechnet in Schweizer Kalendertagen.
 * Negative Werte liegen in der Vergangenheit.
 */
export function daysUntil(value: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const target = zonedDayStart(new Date(value));
  const today = zonedDayStart(now);
  if (!Number.isFinite(target) || !Number.isFinite(today)) return null;
  return Math.round((target - today) / 86_400_000);
}

/**
 * Wahrheitsgemässe Angabe zum Start eines Turniers.
 *
 * Bewusst auf Tagesebene und serverseitig berechnet: kein tickender Zähler,
 * kein zusätzliches JavaScript und keine Angabe, die genauer wirkt als sie ist.
 * Ohne gepflegten Termin gibt es keine Ausgabe.
 */
export function formatCountdown(value: Date | string | null | undefined, now: Date = new Date()): string | null {
  const days = daysUntil(value, now);
  if (days === null || days < 0) return null;
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  if (days <= 60) return `in ${days} Tagen`;
  return null;
}

/** Für <time datetime="…"> – maschinenlesbar und zeitzonensicher. */
export function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

/** Erzeugt einen URL-tauglichen Slug mit korrekter Behandlung von Umlauten. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Menschlich lesbare Dateigrösse. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
