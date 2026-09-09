import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

/**
 * SMTP-Anbindung.
 *
 * Zugangsdaten kommen ausschliesslich aus Umgebungsvariablen und werden nie in
 * der Datenbank oder im Frontend abgelegt. Ist kein SMTP konfiguriert, bleibt
 * der Versand deaktiviert – die Anwendung meldet das im Dashboard, statt still
 * zu scheitern oder Versand vorzutäuschen.
 */

const globalForMail = globalThis as unknown as { __swisshubTransport?: Transporter | null };

export function isMailConfigured(): boolean {
  return env().mailConfigured;
}

export function getTransport(): Transporter | null {
  if (!isMailConfigured()) return null;

  if (globalForMail.__swisshubTransport === undefined) {
    const config = env();
    globalForMail.__swisshubTransport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth:
        config.SMTP_USER.length > 0
          ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
          : undefined,
      // Verbindungen wiederverwenden, aber begrenzt – schont Anbieterlimits.
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      requireTLS: !config.SMTP_SECURE,
    });
  }

  return globalForMail.__swisshubTransport ?? null;
}

export async function verifyTransport(): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport();
  if (!transport) {
    return { ok: false, error: 'Es ist kein SMTP-Server konfiguriert (SMTP_HOST, MAIL_FROM_ADDRESS).' };
  }

  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unbekannter SMTP-Fehler.' };
  }
}

/** Entfernt Zeilenumbrüche aus Kopfzeilenwerten (Header-Injection-Schutz). */
export function sanitiseHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
