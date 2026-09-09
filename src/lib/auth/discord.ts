import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '@/lib/env';

/**
 * Discord-OAuth2-Anbindung mit PKCE.
 *
 * Ein erfolgreicher Discord-Login allein berechtigt niemanden. Zusätzlich wird
 * serverseitig geprüft, ob die Person Mitglied des konfigurierten
 * SwissHub-Servers ist und über eine freigegebene Rolle bzw. eine explizit
 * erlaubte Benutzer-ID verfügt.
 */

const DISCORD_API = 'https://discord.com/api/v10';
const OAUTH_SCOPES = ['identify', 'guilds.members.read'] as const;

export type DiscordProfile = {
  id: string;
  username: string;
  globalName: string | null;
  discriminator: string;
  avatarUrl: string | null;
};

export type DiscordMembership = {
  isMember: boolean;
  roleIds: string[];
  nickname: string | null;
};

export type PkcePair = { verifier: string; challenge: string };

export function createPkcePair(): PkcePair {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthorizeUrl(state: string, codeChallenge: string): string {
  const config = env();
  const params = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export class DiscordAuthError extends Error {
  constructor(
    message: string,
    readonly reason: 'exchange_failed' | 'profile_failed' | 'membership_failed' | 'not_configured',
  ) {
    super(message);
    this.name = 'DiscordAuthError';
  }
}

async function discordFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, {
    ...init,
    // Discord-Antworten dürfen nie zwischengespeichert werden.
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<string> {
  const config = env();
  if (!config.discordConfigured) {
    throw new DiscordAuthError('Discord-OAuth ist nicht konfiguriert.', 'not_configured');
  }

  const response = await discordFetch('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.discordRedirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new DiscordAuthError('Der Autorisierungscode konnte nicht eingelöst werden.', 'exchange_failed');
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new DiscordAuthError('Discord hat kein Zugriffstoken geliefert.', 'exchange_failed');
  }
  return payload.access_token;
}

export async function fetchProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await discordFetch('/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new DiscordAuthError('Das Discord-Profil konnte nicht geladen werden.', 'profile_failed');
  }

  const user = (await response.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    discriminator?: string;
    avatar?: string | null;
  };

  return {
    id: user.id,
    username: user.username,
    globalName: user.global_name ?? null,
    discriminator: user.discriminator ?? '0',
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : null,
  };
}

/**
 * Ermittelt die Mitgliedschaft im konfigurierten SwissHub-Server.
 * Primär über das Benutzertoken (Scope `guilds.members.read`), ersatzweise über
 * ein Bot-Token. Schlägt beides fehl, gilt die Person als nicht berechtigt –
 * es gibt bewusst keinen Fallback, der den Zugriff öffnet.
 */
export async function fetchMembership(accessToken: string, userId: string): Promise<DiscordMembership> {
  const config = env();
  const guildId = config.DISCORD_GUILD_ID;

  const userScoped = await discordFetch(`/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (userScoped.ok) {
    const member = (await userScoped.json()) as { roles?: string[]; nick?: string | null };
    return { isMember: true, roleIds: member.roles ?? [], nickname: member.nick ?? null };
  }

  // 404 bedeutet gesichert: keine Mitgliedschaft.
  if (userScoped.status === 404) {
    return { isMember: false, roleIds: [], nickname: null };
  }

  if (config.DISCORD_BOT_TOKEN) {
    const botScoped = await discordFetch(`/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` },
    });

    if (botScoped.ok) {
      const member = (await botScoped.json()) as { roles?: string[]; nick?: string | null };
      return { isMember: true, roleIds: member.roles ?? [], nickname: member.nick ?? null };
    }
    if (botScoped.status === 404) {
      return { isMember: false, roleIds: [], nickname: null };
    }
  }

  throw new DiscordAuthError(
    'Die Server-Mitgliedschaft konnte nicht geprüft werden.',
    'membership_failed',
  );
}

/**
 * Entscheidet anhand der Konfiguration, ob eine Person den Admin-Bereich
 * überhaupt betreten darf. Die konkreten Rechte ergeben sich anschliessend aus
 * den in der Datenbank zugewiesenen Rollen.
 */
export function isAuthorisedByConfig(
  profileId: string,
  membership: DiscordMembership,
): { allowed: boolean; viaRole: boolean; viaAllowlist: boolean } {
  const config = env();
  const viaAllowlist = config.DISCORD_ALLOWED_USER_IDS.includes(profileId);
  const viaRole =
    config.DISCORD_ADMIN_ROLE_IDS.length > 0 &&
    membership.roleIds.some((roleId) => config.DISCORD_ADMIN_ROLE_IDS.includes(roleId));

  return { allowed: viaAllowlist || viaRole, viaRole, viaAllowlist };
}
