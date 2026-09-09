import 'server-only';
import { env } from '@/lib/env';

/**
 * Optionale CAPTCHA-Prüfung mit Cloudflare Turnstile.
 *
 * Turnstile kommt ohne Bilderrätsel aus und ist datenschutzfreundlicher als
 * klassische Alternativen. Die Prüfung ist nur aktiv, wenn sowohl Schlüssel
 * hinterlegt als auch die Funktion im Dashboard eingeschaltet ist.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type CaptchaResult = { ok: true } | { ok: false; reason: string };

export async function verifyCaptcha(token: string | null, remoteIp?: string | null): Promise<CaptchaResult> {
  const config = env();
  if (!config.captchaConfigured) {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, reason: 'Bitte bestätige die Sicherheitsabfrage.' };
  }

  try {
    const body = new URLSearchParams({ secret: config.TURNSTILE_SECRET_KEY, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { ok: false, reason: 'Die Sicherheitsabfrage konnte nicht geprüft werden. Bitte versuche es erneut.' };
    }

    const payload = (await response.json()) as { success?: boolean };
    return payload.success
      ? { ok: true }
      : { ok: false, reason: 'Die Sicherheitsabfrage ist fehlgeschlagen. Bitte versuche es erneut.' };
  } catch {
    return { ok: false, reason: 'Die Sicherheitsabfrage ist zurzeit nicht erreichbar. Bitte versuche es später erneut.' };
  }
}
