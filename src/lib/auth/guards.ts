import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import type { PermissionKey } from '@/lib/permissions';
import { getCurrentUser, userHasPermission, type CurrentUser } from '@/lib/auth/session';
import { AuthorizationError } from '@/lib/auth/errors';

export { AuthorizationError };

/** Erzwingt eine gültige Session; leitet sonst zum Admin-Login. */
export async function requireUser(redirectPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = redirectPath ? `/admin/login?next=${encodeURIComponent(redirectPath)}` : '/admin/login';
    redirect(target);
  }
  return user;
}

/**
 * Erzwingt eine Berechtigung. Wird in jeder geschützten Route und in jeder
 * Server Action erneut aufgerufen – die Oberfläche allein schützt nichts.
 */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!userHasPermission(user, permission)) {
    redirect(`/admin/kein-zugriff?benoetigt=${encodeURIComponent(permission)}`);
  }
  return user;
}

/** Variante für Server Actions: wirft statt zu rendern. */
export async function requirePermissionForAction(permission: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
  }
  if (!userHasPermission(user, permission)) {
    throw new AuthorizationError();
  }
  return user;
}

/**
 * Zusätzlicher CSRF-Schutz für Route Handler. Session-Cookies sind bereits
 * `SameSite=Lax`; diese Prüfung fängt Sonderfälle wie fehlkonfigurierte Proxys ab.
 */
export async function assertSameOrigin(): Promise<void> {
  const headerList = await headers();
  const origin = headerList.get('origin');
  if (!origin) return; // Klassische Formulare senden kein Origin bei GET.

  const expected = new URL(env().APP_URL).origin;
  const forwardedHost = headerList.get('x-forwarded-host') ?? headerList.get('host');

  if (origin === expected) return;
  if (forwardedHost && origin === `https://${forwardedHost}`) return;
  if (forwardedHost && origin === `http://${forwardedHost}`) return;

  throw new AuthorizationError('Ungültige Anfrageherkunft.');
}
