import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Fensterbasiertes Rate Limiting auf Datenbankbasis.
 *
 * Bewusst persistent: Ein Neustart darf ein Limit für Login-Versuche oder das
 * Kontaktformular nicht zurücksetzen. Der Zähler ist ein einzelner Upsert und
 * damit auch bei hoher Last günstig.
 */

export type RateLimitRule = {
  bucket: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  contactForm: { bucket: 'contact-form', limit: 5, windowSeconds: 3600 },
  contactFormBurst: { bucket: 'contact-form-burst', limit: 2, windowSeconds: 60 },
  loginStart: { bucket: 'login-start', limit: 10, windowSeconds: 900 },
  loginCallback: { bucket: 'login-callback', limit: 15, windowSeconds: 900 },
  mediaUpload: { bucket: 'media-upload', limit: 60, windowSeconds: 3600 },
  metricsBeacon: { bucket: 'metrics-beacon', limit: 120, windowSeconds: 600 },
  adminMutation: { bucket: 'admin-mutation', limit: 300, windowSeconds: 300 },
  testMail: { bucket: 'test-mail', limit: 5, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function windowStart(windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(Date.now() / ms) * ms);
}

export async function consumeRateLimit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const start = windowStart(rule.windowSeconds);
  const expiresAt = new Date(start.getTime() + rule.windowSeconds * 1000);

  const counter = await prisma.rateLimitCounter.upsert({
    where: {
      bucket_identifier_windowStart: {
        bucket: rule.bucket,
        identifier,
        windowStart: start,
      },
    },
    create: { bucket: rule.bucket, identifier, windowStart: start, count: 1, expiresAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const allowed = counter.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - counter.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
  };
}

/** Entfernt abgelaufene Zähler. Wird vom Hintergrund-Scheduler aufgerufen. */
export async function pruneRateLimits(): Promise<number> {
  const result = await prisma.rateLimitCounter.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
