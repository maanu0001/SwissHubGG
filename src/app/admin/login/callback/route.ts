import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { hashIp, hashToken } from '@/lib/crypto';
import {
  DiscordAuthError,
  exchangeCode,
  fetchMembership,
  fetchProfile,
  isAuthorisedByConfig,
} from '@/lib/auth/discord';
import { OAUTH_STATE_COOKIE, cookieOptions, createSession } from '@/lib/auth/session';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { AUDIT_ACTIONS, recordSystemAudit } from '@/lib/audit';

/**
 * Rückruf des Discord-OAuth2-Flows.
 *
 * Zugriff erhält nur, wer Mitglied des konfigurierten SwissHub-Servers ist und
 * entweder über eine freigegebene Rolle verfügt, ausdrücklich per Benutzer-ID
 * erlaubt wurde oder bereits ein aktives Admin-Konto besitzt. Fällt Discord
 * aus, wird der Zugriff verweigert – es gibt keinen Notfall-Bypass.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(request: NextRequest, reason: string): NextResponse {
  const url = new URL('/admin/login', request.url);
  url.searchParams.set('fehler', reason);
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = env();
  const forwarded = config.TRUST_PROXY ? request.headers.get('x-forwarded-for') : null;
  const ip = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
  const ipHash = hashIp(ip) ?? 'unknown';

  const limit = await consumeRateLimit(RATE_LIMITS.loginCallback, ipHash);
  if (!limit.allowed) {
    return fail(request, 'zu_viele_versuche');
  }

  if (request.nextUrl.searchParams.get('error')) {
    return fail(request, 'abgebrochen');
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const store = await cookies();
  const cookieState = store.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail(request, 'ungueltiger_status');
  }

  // Der gespeicherte Zustand ist einmalig verwendbar.
  const stored = await prisma.oAuthState.findUnique({ where: { stateHash: hashToken(state) } });
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    if (stored) await prisma.oAuthState.delete({ where: { id: stored.id } }).catch(() => undefined);
    return fail(request, 'abgelaufen');
  }
  await prisma.oAuthState.delete({ where: { id: stored.id } }).catch(() => undefined);

  try {
    const accessToken = await exchangeCode(code, stored.codeVerifier);
    const profile = await fetchProfile(accessToken);
    const membership = await fetchMembership(accessToken, profile.id);

    if (!membership.isMember) {
      await recordSystemAudit(
        AUDIT_ACTIONS.LOGIN_DENIED,
        'AdminUser',
        `Anmeldung abgelehnt: ${profile.username} ist kein Mitglied des SwissHub-Servers.`,
        { discordId: profile.id },
      );
      return fail(request, 'keine_mitgliedschaft');
    }

    const existing = await prisma.adminUser.findUnique({
      where: { discordId: profile.id },
      select: { id: true, isActive: true },
    });

    const authorisation = isAuthorisedByConfig(profile.id, membership);
    const isBootstrapSuperAdmin = config.DISCORD_BOOTSTRAP_SUPERADMIN_IDS.includes(profile.id);

    if (existing && !existing.isActive) {
      await recordSystemAudit(
        AUDIT_ACTIONS.LOGIN_DENIED,
        'AdminUser',
        `Anmeldung abgelehnt: Konto von ${profile.username} ist deaktiviert.`,
        { discordId: profile.id },
        existing.id,
      );
      return fail(request, 'konto_deaktiviert');
    }

    if (!existing && !authorisation.allowed && !isBootstrapSuperAdmin) {
      await recordSystemAudit(
        AUDIT_ACTIONS.LOGIN_DENIED,
        'AdminUser',
        `Anmeldung abgelehnt: ${profile.username} besitzt keine Admin-Berechtigung.`,
        { discordId: profile.id },
      );
      return fail(request, 'keine_berechtigung');
    }

    const displayName = membership.nickname ?? profile.globalName ?? profile.username;
    const discordTag = profile.discriminator === '0' ? profile.username : `${profile.username}#${profile.discriminator}`;

    const user = await prisma.adminUser.upsert({
      where: { discordId: profile.id },
      create: {
        discordId: profile.id,
        discordTag,
        displayName,
        avatarUrl: profile.avatarUrl,
        isSuperAdmin: isBootstrapSuperAdmin,
        lastLoginAt: new Date(),
      },
      update: {
        discordTag,
        displayName,
        avatarUrl: profile.avatarUrl,
        lastLoginAt: new Date(),
        ...(isBootstrapSuperAdmin ? { isSuperAdmin: true } : {}),
      },
      select: { id: true, displayName: true, roles: { select: { roleId: true } } },
    });

    // Neue Konten erhalten zunächst nur Leserechte; die Rollenvergabe erfolgt
    // bewusst manuell durch einen Superadmin.
    if (user.roles.length === 0 && !isBootstrapSuperAdmin) {
      const readonly = await prisma.role.findUnique({ where: { key: 'readonly' }, select: { id: true } });
      if (readonly) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: readonly.id } });
      }
    }

    await createSession(user.id);

    await recordSystemAudit(
      AUDIT_ACTIONS.LOGIN_SUCCESS,
      'AdminUser',
      `${user.displayName} hat sich angemeldet.`,
      { viaRole: authorisation.viaRole, viaAllowlist: authorisation.viaAllowlist },
      user.id,
    );

    const target = stored.redirectPath ?? '/admin';
    const response = NextResponse.redirect(new URL(target, request.url));
    response.cookies.set(OAUTH_STATE_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (error) {
    const reason = error instanceof DiscordAuthError ? error.reason : 'unbekannt';
    await recordSystemAudit(AUDIT_ACTIONS.LOGIN_FAILED, 'AdminUser', 'Anmeldung über Discord fehlgeschlagen.', {
      reason,
    });
    return fail(request, reason === 'membership_failed' ? 'discord_nicht_erreichbar' : 'anmeldung_fehlgeschlagen');
  }
}
