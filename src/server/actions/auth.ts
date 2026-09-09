'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { destroyCurrentSession, getCurrentUser } from '@/lib/auth/session';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { failure, runAction, success, text, type ActionState } from '@/server/actions/types';

/** Meldet die aktuelle Person ab und widerruft die Sitzung serverseitig. */
export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: 'AdminUser',
      entityId: user.id,
      summary: `${user.displayName} hat sich abgemeldet.`,
      actor: user,
    });
  }

  await destroyCurrentSession('logout');
  redirect('/admin/login');
}

/** Widerruft alle Sitzungen eines Kontos – wirkt sofort. */
export async function revokeSessionsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermissionForAction(PERMISSIONS.USERS_MANAGE);
    const userId = text(formData, 'userId');

    if (!userId) return failure('Es wurde kein Konto ausgewählt.');

    const target = await prisma.adminUser.findUnique({ where: { id: userId }, select: { displayName: true } });
    if (!target) return failure('Das Konto wurde nicht gefunden.');

    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'admin-revoke' },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      entityType: 'AdminUser',
      entityId: userId,
      summary: `Alle Sitzungen von ${target.displayName} widerrufen (${result.count}).`,
      actor,
    });

    return success(
      result.count === 0
        ? 'Es waren keine aktiven Sitzungen vorhanden.'
        : `${result.count} Sitzung(en) wurden widerrufen.`,
    );
  });
}
