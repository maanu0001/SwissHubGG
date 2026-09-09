import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prepareSchema, resetDatabase, testPrisma } from '../setup/testDb';
import { PERMISSIONS, PERMISSION_CATALOGUE, ROLE_CATALOGUE } from '@/lib/permissions';

/**
 * Integrationstests des Rollen- und Rechtesystems.
 *
 * Geprüft wird die serverseitige Auflösung: welche Rechte ein Konto durch seine
 * Rollen tatsächlich erhält und dass Änderungen sofort greifen.
 */

beforeAll(() => {
  prepareSchema();
});

beforeEach(async () => {
  await resetDatabase();
  await seedRolesAndPermissions();
});

async function seedRolesAndPermissions(): Promise<void> {
  await testPrisma.permission.createMany({ data: PERMISSION_CATALOGUE });

  for (const role of ROLE_CATALOGUE) {
    const created = await testPrisma.role.create({
      data: {
        key: role.key,
        name: role.name,
        description: role.description,
        sortOrder: role.sortOrder,
        isSystem: true,
      },
    });

    const permissions = await testPrisma.permission.findMany({
      where: { key: { in: role.permissions } },
      select: { id: true },
    });

    await testPrisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: created.id, permissionId: permission.id })),
    });
  }
}

/** Bildet die Auflösung aus `getCurrentUser` nach: Rollen → Berechtigungen. */
async function resolvePermissions(userId: string): Promise<Set<string>> {
  const user = await testPrisma.adminUser.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });

  const permissions = new Set<string>();
  for (const assignment of user.roles) {
    for (const entry of assignment.role.permissions) {
      permissions.add(entry.permission.key);
    }
  }
  return permissions;
}

async function createUser(discordId: string, roleKeys: string[] = []) {
  const user = await testPrisma.adminUser.create({
    data: { discordId, discordTag: `user-${discordId}`, displayName: `Konto ${discordId}` },
  });

  if (roleKeys.length > 0) {
    const roles = await testPrisma.role.findMany({ where: { key: { in: roleKeys } }, select: { id: true } });
    await testPrisma.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id })),
    });
  }

  return user;
}

describe('Rollenauflösung', () => {
  it('gibt einem Konto ohne Rolle keine Berechtigungen', async () => {
    const user = await createUser('100');
    expect((await resolvePermissions(user.id)).size).toBe(0);
  });

  it('gibt der Redaktion Bearbeitungs-, aber keine Benutzerrechte', async () => {
    const user = await createUser('101', ['redaktion']);
    const permissions = await resolvePermissions(user.id);

    expect(permissions.has(PERMISSIONS.PAGES_EDIT)).toBe(true);
    expect(permissions.has(PERMISSIONS.PAGES_PUBLISH)).toBe(true);
    expect(permissions.has(PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(permissions.has(PERMISSIONS.TOURNAMENTS_MANAGE)).toBe(false);
  });

  it('gibt der Turnierverwaltung keine Kontaktrechte', async () => {
    const user = await createUser('102', ['turnierverwaltung']);
    const permissions = await resolvePermissions(user.id);

    expect(permissions.has(PERMISSIONS.TOURNAMENTS_MANAGE)).toBe(true);
    expect(permissions.has(PERMISSIONS.CONTACT_READ)).toBe(false);
    expect(permissions.has(PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('vereinigt die Rechte mehrerer Rollen', async () => {
    const user = await createUser('103', ['redaktion', 'kontaktverwaltung']);
    const permissions = await resolvePermissions(user.id);

    expect(permissions.has(PERMISSIONS.PAGES_EDIT)).toBe(true);
    expect(permissions.has(PERMISSIONS.CONTACT_RESPOND)).toBe(true);
    expect(permissions.has(PERMISSIONS.USERS_MANAGE)).toBe(false);
  });

  it('wirkt sich sofort aus, wenn eine Rolle entzogen wird', async () => {
    const user = await createUser('104', ['administrator']);
    expect((await resolvePermissions(user.id)).has(PERMISSIONS.TOURNAMENTS_MANAGE)).toBe(true);

    await testPrisma.userRole.deleteMany({ where: { userId: user.id } });
    expect((await resolvePermissions(user.id)).size).toBe(0);
  });

  it('wirkt sich sofort aus, wenn einer Rolle ein Recht entzogen wird', async () => {
    const user = await createUser('105', ['sponsoring']);
    expect((await resolvePermissions(user.id)).has(PERMISSIONS.SPONSORS_MANAGE)).toBe(true);

    const role = await testPrisma.role.findUniqueOrThrow({ where: { key: 'sponsoring' } });
    const permission = await testPrisma.permission.findUniqueOrThrow({
      where: { key: PERMISSIONS.SPONSORS_MANAGE },
    });
    await testPrisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
    });

    expect((await resolvePermissions(user.id)).has(PERMISSIONS.SPONSORS_MANAGE)).toBe(false);
  });
});

describe('Sitzungen', () => {
  it('erkennt widerrufene und abgelaufene Sitzungen als ungültig', async () => {
    const user = await createUser('106', ['readonly']);

    const [active, revoked, expired] = await Promise.all([
      testPrisma.session.create({
        data: { tokenHash: 'hash-active', userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
      }),
      testPrisma.session.create({
        data: {
          tokenHash: 'hash-revoked',
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600_000),
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      }),
      testPrisma.session.create({
        data: { tokenHash: 'hash-expired', userId: user.id, expiresAt: new Date(Date.now() - 1000) },
      }),
    ]);

    const isValid = (session: { revokedAt: Date | null; expiresAt: Date }) =>
      session.revokedAt === null && session.expiresAt.getTime() > Date.now();

    expect(isValid(active)).toBe(true);
    expect(isValid(revoked)).toBe(false);
    expect(isValid(expired)).toBe(false);
  });

  it('entfernt Sitzungen mit dem zugehörigen Konto', async () => {
    const user = await createUser('107');
    await testPrisma.session.create({
      data: { tokenHash: 'hash-cascade', userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
    });

    await testPrisma.adminUser.delete({ where: { id: user.id } });
    expect(await testPrisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('Audit-Log', () => {
  it('behält Einträge, auch wenn das auslösende Konto gelöscht wird', async () => {
    const user = await createUser('108', ['administrator']);

    await testPrisma.auditLog.create({
      data: {
        actorId: user.id,
        actorLabel: user.displayName,
        action: 'entity.update',
        entityType: 'Page',
        summary: 'Seite bearbeitet.',
      },
    });

    await testPrisma.adminUser.delete({ where: { id: user.id } });

    const entries = await testPrisma.auditLog.findMany();
    expect(entries).toHaveLength(1);
    // Die Zuordnung wird gelöst, der Nachweis bleibt bestehen.
    expect(entries[0]?.actorId).toBeNull();
    expect(entries[0]?.actorLabel).toBe('Konto 108');
  });
});
