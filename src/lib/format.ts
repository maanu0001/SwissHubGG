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
