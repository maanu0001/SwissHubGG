import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { hashIp, hashToken, randomToken } from '@/lib/crypto';
import { buildAuthorizeUrl, createPkcePair } from '@/lib/auth/discord';
import { OAUTH_STATE_COOKIE, cookieOptions } from '@/lib/auth/session';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { internalUrl, safeInternalPath } from '@/lib/publicUrl';

/**
 * Startet den Discord-OAuth2-Flow.
 *
 * Der `state`-Wert wird sowohl als kurzlebiges Cookie als auch (gehasht) in der
 * Datenbank hinterlegt. Nur wenn beides zusammenpasst, gilt der Rückruf als
 * gültig – das verhindert untergeschobene Anmeldungen (CSRF).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_SECONDS = 600;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = env();

  if (!config.discordConfigured) {
    return NextResponse.redirect(internalUrl('/admin/login?fehler=nicht_konfiguriert', request.headers));
  }

  const forwarded = config.TRUST_PROXY ? request.headers.get('x-forwarded-for') : null;
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
  const limit = await consumeRateLimit(RATE_LIMITS.loginStart, hashIp(ip) ?? 'unknown');

  if (!limit.allowed) {
    return NextResponse.redirect(internalUrl('/admin/login?fehler=zu_viele_versuche', request.headers));
  }

  const state = randomToken(24);
  const { verifier, challenge } = createPkcePair();

  // Nur interne Pfade im Admin-Bereich sind als Ziel erlaubt – Schutz vor
  // offenen Weiterleitungen auf fremde Domains.
  const requestedNext = safeInternalPath(request.nextUrl.searchParams.get('next'), '');
  const redirectPath = requestedNext.startsWith('/admin') ? requestedNext : null;

  await prisma.oAuthState.create({
    data: {
      stateHash: hashToken(state),
      codeVerifier: verifier,
      redirectPath,
      expiresAt: new Date(Date.now() + STATE_TTL_SECONDS * 1000),
    },
  });

  const store = await cookies();
  store.set(OAUTH_STATE_COOKIE, state, cookieOptions(STATE_TTL_SECONDS));

  return NextResponse.redirect(buildAuthorizeUrl(state, challenge));
}
