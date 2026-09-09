'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { checkbox, failure, runAction, success, text, type ActionState } from '@/server/actions/types';

/**
 * Benutzer- und Rollenverwaltung.
 *
 * Änderungen wirken sofort: Berechtigungen werden bei jedem Request frisch aus
 * der Datenbank gelesen, es gibt keinen Rechte-Cache über Requests hinweg.
 */

export async function setUserRolesAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermissionForAction(PERMISSIONS.USERS_MANAGE);
    const userId = text(formData, 'userId');
    const roleIds = formData.getAll('roleIds').filter((entry): entry is string => typeof entry === 'string');

    const target = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { displayName: true, isSuperAdmin: true },
    });
    if (!target) return failure('Das Konto wurde nicht gefunden.');

    const roles = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } });

    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entityType: 'AdminUser',
      entityId: userId,
      summary: `Rollen von ${target.displayName} gesetzt: ${roles.map((role) => role.name).join(', ') || 'keine'}.`,
      metadata: { roleIds },
      actor,
    });

    revalidatePath('/admin/benutzer');
    return success('Die Rollen wurden gespeichert und wirken sofort.');
  });
}

export async function setUserStatusAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermissionForAction(PERMISSIONS.USERS_MANAGE);
    const userId = text(formData, 'userId');
    const active = checkbox(formData, 'isActive');

    if (userId === actor.id && !active) {
      return failure('Du kannst dein eigenes Konto nicht deaktivieren.');
    }

    const target = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { displayName: true, isSuperAdmin: true },
    });
    if (!target) return failure('Das Konto wurde nicht gefunden.');

    if (target.isSuperAdmin && !active) {
      const remaining = await prisma.adminUser.count({
        where: { isSuperAdmin: true, isActive: true, id: { not: userId } },
      });
      if (remaining === 0) {
        return failure('Es muss mindestens ein aktiver Superadmin bestehen bleiben.');
      }
    }

    await prisma.adminUser.update({ where: { id: userId }, data: { isActive: active } });

    // Ein deaktiviertes Konto verliert sofort alle laufenden Sitzungen.
    if (!active) {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'account-disabled' },
      });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entityType: 'AdminUser',
      entityId: userId,
      summary: `Konto ${target.displayName} ${active ? 'aktiviert' : 'deaktiviert'}.`,
      actor,
    });

    revalidatePath('/admin/benutzer');
    return success(active ? 'Das Konto wurde aktiviert.' : 'Das Konto wurde deaktiviert und alle Sitzungen beendet.');
  });
}

export async function setSuperAdminAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermissionForAction(PERMISSIONS.USERS_MANAGE);

    if (!actor.isSuperAdmin) {
      return failure('Nur Superadmins können den Superadmin-Status ändern.');
    }

    const userId = text(formData, 'userId');
    const makeSuperAdmin = checkbox(formData, 'isSuperAdmin');

    const target = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: { displayName: true, isSuperAdmin: true },
    });
    if (!target) return failure('Das Konto wurde nicht gefunden.');

    if (target.isSuperAdmin && !makeSuperAdmin) {
      const remaining = await prisma.adminUser.count({
        where: { isSuperAdmin: true, isActive: true, id: { not: userId } },
      });
      if (remaining === 0) {
        return failure('Es muss mindestens ein aktiver Superadmin bestehen bleiben.');
      }
    }

    await prisma.adminUser.update({ where: { id: userId }, data: { isSuperAdmin: makeSuperAdmin } });

    await recordAudit({
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entityType: 'AdminUser',
      entityId: userId,
      summary: `Superadmin-Status von ${target.displayName} ${makeSuperAdmin ? 'gesetzt' : 'entzogen'}.`,
      actor,
    });

    revalidatePath('/admin/benutzer');
    return success('Der Superadmin-Status wurde geändert.');
  });
}

export async function setRolePermissionsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requirePermissionForAction(PERMISSIONS.USERS_MANAGE);
    const roleId = text(formData, 'roleId');
    const permissionKeys = formData
      .getAll('permissions')
      .filter((entry): entry is string => typeof entry === 'string');

    const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true, key: true } });
    if (!role) return failure('Die Rolle wurde nicht gefunden.');

    if (role.key === 'superadmin') {
      return failure('Die Rolle „Superadmin“ besitzt immer alle Rechte und kann nicht eingeschränkt werden.');
    }

    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId, permissionId: permission.id })),
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.ROLE_CHANGE,
      entityType: 'Role',
      entityId: roleId,
      summary: `Berechtigungen der Rolle „${role.name}“ aktualisiert (${permissions.length}).`,
      metadata: { permissions: permissionKeys },
      actor,
    });

    revalidatePath('/admin/benutzer');
    return success('Die Berechtigungen wurden gespeichert und wirken sofort.');
  });
}
