import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/** Kryptografisch sicheres Token in URL-tauglicher Form. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Session-Token werden nie im Klartext gespeichert. In der Datenbank liegt nur
 * ein HMAC, sodass ein Datenbankleck keine übernehmbaren Sessions liefert.
 */
export function hashToken(token: string): string {
  return createHmac('sha256', env().SESSION_SECRET).update(token).digest('hex');
}

/**
 * IP-Adressen werden ausschliesslich pseudonymisiert gespeichert (Spam-Abwehr,
 * Rate Limiting). Der Klartext verlässt den Request nicht.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHmac('sha256', env().SESSION_SECRET).update(`ip:${ip}`).digest('hex').slice(0, 40);
}

export function sha256(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Zeitkonstanter Vergleich zweier Zeichenketten gleicher Bedeutung. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
