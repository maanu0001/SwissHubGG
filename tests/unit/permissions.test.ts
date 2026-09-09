import { describe, expect, it } from 'vitest';
import { PERMISSIONS, PERMISSION_CATALOGUE, ROLE_CATALOGUE, permissionGroups } from '@/lib/permissions';
import { userHasAnyPermission, userHasPermission, type CurrentUser } from '@/lib/auth/session';

function makeUser(permissions: string[], isSuperAdmin = false): CurrentUser {
  return {
    id: 'u1',
    discordId: '1',
    displayName: 'Testperson',
    discordTag: 'test',
    avatarUrl: null,
    isSuperAdmin,
    roles: [],
    permissions: new Set(permissions),
    sessionId: 's1',
  };
}

describe('Berechtigungskatalog', () => {
  it('enthält jeden Schlüssel genau einmal', () => {
    const keys = PERMISSION_CATALOGUE.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('deckt alle definierten Berechtigungen ab', () => {
    const catalogue = new Set(PERMISSION_CATALOGUE.map((entry) => entry.key));
    for (const key of Object.values(PERMISSIONS)) {
      expect(catalogue.has(key), `${key} fehlt im Katalog`).toBe(true);
    }
  });

  it('vergibt in Rollen nur bekannte Berechtigungen', () => {
    const catalogue = new Set(PERMISSION_CATALOGUE.map((entry) => entry.key));
    for (const role of ROLE_CATALOGUE) {
      for (const permission of role.permissions) {
        expect(catalogue.has(permission), `${role.key}: ${permission} unbekannt`).toBe(true);
      }
    }
  });

  it('gibt der Rolle Superadmin alle Rechte', () => {
    const superadmin = ROLE_CATALOGUE.find((role) => role.key === 'superadmin');
    expect(superadmin?.permissions.length).toBe(PERMISSION_CATALOGUE.length);
  });

  it('gibt der Rolle „Nur Lesen“ keine schreibenden Rechte', () => {
    const readonly = ROLE_CATALOGUE.find((role) => role.key === 'readonly');
    const writing = [
      PERMISSIONS.PAGES_EDIT,
      PERMISSIONS.PAGES_PUBLISH,
      PERMISSIONS.TOURNAMENTS_MANAGE,
      PERMISSIONS.SPONSORS_MANAGE,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.CONTACT_DELETE,
    ];

    for (const permission of writing) {
      expect(readonly?.permissions).not.toContain(permission);
    }
  });

  it('nimmt der Administratorrolle die Benutzerverwaltung', () => {
    const administrator = ROLE_CATALOGUE.find((role) => role.key === 'administrator');
    expect(administrator?.permissions).not.toContain(PERMISSIONS.USERS_MANAGE);
  });

  it('gruppiert den Katalog vollständig', () => {
    const grouped = permissionGroups().flatMap((group) => group.permissions);
    expect(grouped.length).toBe(PERMISSION_CATALOGUE.length);
  });
});

describe('Berechtigungsprüfung', () => {
  it('erlaubt zugewiesene Berechtigungen', () => {
    const user = makeUser([PERMISSIONS.PAGES_EDIT]);
    expect(userHasPermission(user, PERMISSIONS.PAGES_EDIT)).toBe(true);
  });

  it('verweigert nicht zugewiesene Berechtigungen', () => {
    const user = makeUser([PERMISSIONS.PAGES_EDIT]);
    expect(userHasPermission(user, PERMISSIONS.PAGES_PUBLISH)).toBe(false);
    expect(userHasPermission(user, PERMISSIONS.USERS_MANAGE)).toBe(false);
  });

  it('gibt Superadmins implizit jede Berechtigung', () => {
    const user = makeUser([], true);
    for (const key of Object.values(PERMISSIONS)) {
      expect(userHasPermission(user, key)).toBe(true);
    }
  });

  it('verweigert allen Zugriff ohne Anmeldung', () => {
    for (const key of Object.values(PERMISSIONS)) {
      expect(userHasPermission(null, key)).toBe(false);
    }
  });

  it('prüft mehrere Berechtigungen als Oder-Verknüpfung', () => {
    const user = makeUser([PERMISSIONS.SOCIAL_POSTS_MANAGE]);
    expect(userHasAnyPermission(user, [PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE, PERMISSIONS.SOCIAL_POSTS_MANAGE])).toBe(true);
    expect(userHasAnyPermission(user, [PERMISSIONS.USERS_MANAGE, PERMISSIONS.SETTINGS_MANAGE])).toBe(false);
  });
});
