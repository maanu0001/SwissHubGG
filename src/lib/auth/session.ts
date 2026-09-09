import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { hashIp, hashToken, randomToken } from '@/lib/crypto';
import type { PermissionKey } from '@/lib/permissions';

export const SESSION_COOKIE = 'swisshub_session';
export const OAUTH_STATE_COOKIE = 'swisshub_oauth';

export type CurrentUser = {
  id: string;
  discordId: string;
  displayName: string;
  discordTag: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
  roles: { key: string; name: string }[];
  permissions: Set<string>;
  sessionId: string;
};

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env().APP_URL.startsWith('https://'),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/** Liest die Client-IP unter Berücksichtigung des Reverse Proxys. */
export async function requestIp(): Promise<string | null> {
  const headerList = await headers();
  if (env().TRUST_PROXY) {
    const forwarded = headerList.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = headerList.get('x-real-ip');
    if (realIp) return realIp.trim();
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const ttlHours = env().SESSION_TTL_HOURS;
  const headerList = await headers();

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      ipHash: hashIp(await requestIp()),
      userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(ttlHours * 3600));
}

export async function destroyCurrentSession(reason = 'logout'): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  store.set(SESSION_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

/**
 * Lädt die angemeldete Person inklusive aktueller Rollen und Rechte.
 *
 * Die Rechte werden bei jedem Request frisch aus der Datenbank gelesen, damit
 * Änderungen an Rollen sofort wirken. `cache` sorgt lediglich dafür, dass
 * innerhalb desselben Requests nur einmal geladen wird.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
            },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  if (!session.user.isActive) {
    return null;
  }

  const permissions = new Set<string>();
  for (const assignment of session.user.roles) {
    for (const rolePermission of assignment.role.permissions) {
      permissions.add(rolePermission.permission.key);
    }
  }

  return {
    id: session.user.id,
    discordId: session.user.discordId,
    displayName: session.user.displayName,
    discordTag: session.user.discordTag,
    avatarUrl: session.user.avatarUrl,
    isSuperAdmin: session.user.isSuperAdmin,
    roles: session.user.roles.map((assignment) => ({
      key: assignment.role.key,
      name: assignment.role.name,
    })),
    permissions,
    sessionId: session.id,
  };
});

/** Superadmins besitzen implizit jede Berechtigung. */
export function userHasPermission(user: CurrentUser | null, permission: PermissionKey): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions.has(permission);
}

export function userHasAnyPermission(user: CurrentUser | null, permissions: PermissionKey[]): boolean {
  return permissions.some((permission) => userHasPermission(user, permission));
}

/** Aktualisiert `lastSeenAt` höchstens einmal alle fünf Minuten. */
export async function touchSession(sessionId: string, lastSeenAt: Date): Promise<void> {
  if (Date.now() - lastSeenAt.getTime() < 5 * 60 * 1000) return;
  await prisma.session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
}

export { cookieOptions };
