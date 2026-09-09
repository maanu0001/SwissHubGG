import { NextResponse, type NextRequest } from 'next/server';
import { MetricType } from '@prisma/client';
import { z } from 'zod';
import { env } from '@/lib/env';
import { recordMetric } from '@/lib/metrics';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { hashIp } from '@/lib/crypto';

/**
 * Endpunkt für anonyme Nutzungszahlen.
 *
 * Nimmt ausschliesslich einen Ereignistyp und einen Schlüssel entgegen. Es
 * werden keine Cookies gesetzt und keine personenbezogenen Daten gespeichert;
 * die IP dient nur pseudonymisiert dem Rate Limiting.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  type: z.enum(Object.values(MetricType) as [MetricType, ...MetricType[]]),
  key: z.string().min(1).max(200),
});

function clientIdentifier(request: NextRequest): string {
  const forwarded = env().TRUST_PROXY ? request.headers.get('x-forwarded-for') : null;
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
  return hashIp(ip) ?? 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!env().METRICS_ENABLED) {
    return new NextResponse(null, { status: 204 });
  }

  // Einfache Bot-Abwehr: sehr grosse Nutzlasten gar nicht erst verarbeiten.
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 1024) {
    return new NextResponse(null, { status: 413 });
  }

  const limit = await consumeRateLimit(RATE_LIMITS.metricsBeacon, clientIdentifier(request));
  if (!limit.allowed) {
    return new NextResponse(null, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  await recordMetric(parsed.data.type, parsed.data.key);
  return new NextResponse(null, { status: 204 });
}
