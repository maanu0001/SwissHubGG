import { ZodError } from 'zod';
import { AuthorizationError } from '@/lib/auth/errors';

/**
 * Einheitliches Ergebnisformat aller Server Actions.
 * Die Oberfläche kann dadurch Erfolg, Fehler und Feldfehler konsistent anzeigen.
 */
export type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors?: Record<string, string>;
  /** Optionale Nutzlast, z. B. die ID eines neu erstellten Datensatzes. */
  data?: Record<string, string>;
};

export const idleState: ActionState = { status: 'idle', message: '' };

export function success(message: string, data?: Record<string, string>): ActionState {
  return { status: 'success', message, ...(data ? { data } : {}) };
}

export function failure(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: 'error', message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export function fromZodError(error: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }

  return failure('Bitte prüfe die markierten Felder.', fieldErrors);
}

/**
 * Fängt erwartbare Fehler ab und übersetzt sie in eine verständliche Meldung.
 * Unerwartete Fehler landen im Serverlog, nicht in der Antwort.
 */
export async function runAction(handler: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return failure(error.message);
    }
    if (error instanceof ZodError) {
      return fromZodError(error);
    }
    // Weiterleitungen und `notFound()` werfen intern – diese müssen durchgereicht werden.
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string') {
      throw error;
    }

    console.error('Server Action fehlgeschlagen:', error);
    return failure('Die Aktion konnte nicht ausgeführt werden. Bitte versuche es erneut.');
  }
}

/** Kleine Helfer zum Auslesen von FormData. */
export function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function optionalText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

export function checkbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'on' || value === 'true' || value === '1';
}

export function integer(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value.length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Wandelt eine `datetime-local`-Eingabe (Schweizer Ortszeit) in einen
 * UTC-Zeitstempel um.
 */
export function dateTime(formData: FormData, key: string): Date | null {
  const value = text(formData, key);
  if (value.length === 0) return null;

  // Der Browser liefert lokale Zeit ohne Zonenangabe; wir interpretieren sie
  // als Europe/Zurich und rechnen in UTC um.
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  const offsetMinutes = zurichOffsetMinutes(naive);
  return new Date(naive.getTime() - offsetMinutes * 60_000);
}

/** Ermittelt den UTC-Versatz von Europe/Zurich für einen Zeitpunkt (Sommerzeit-sicher). */
export function zurichOffsetMinutes(reference: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    timeZoneName: 'longOffset',
  });

  const part = formatter.formatToParts(reference).find((entry) => entry.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const match = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Gegenstück zu `dateTime` für die Vorbelegung von Formularfeldern. */
export function toLocalInputValue(value: Date | null | undefined): string {
  if (!value) return '';
  const offsetMinutes = zurichOffsetMinutes(value);
  const local = new Date(value.getTime() + offsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
}
