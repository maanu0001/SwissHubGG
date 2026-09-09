import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prepareSchema, resetDatabase, testPrisma } from '../setup/testDb';
import { getSettings, parseSettingsPatch, updateSettings } from '@/lib/settings';
import { invalidateTags, CacheTag } from '@/lib/cache';
import { PERMISSIONS, ROLE_CATALOGUE } from '@/lib/permissions';
import { userHasPermission } from '@/lib/auth/session';

/**
 * Integrationstests des Speicherwegs für Einstellungen – gegen eine echte
 * PostgreSQL-Datenbank, damit Constraints, Upserts und Transaktionen wirklich
 * geprüft werden.
 *
 * Der wichtigste Fall: Das Speichern einer Gruppe darf keine andere Gruppe
 * anfassen. Genau daran scheiterte die Einstellungsverwaltung zuvor.
 */

beforeAll(() => {
  prepareSchema();
});

beforeEach(async () => {
  await resetDatabase();
  invalidateTags(CacheTag.settings);
});

async function bestand(): Promise<Record<string, unknown>> {
  const rows = await testPrisma.globalSetting.findMany();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

describe('Einstellungen schreiben', () => {
  it('legt fehlende Datensätze an', async () => {
    const written = await updateSettings({ siteName: 'SwissHub', motto: 'Zäme hock, zäme zocke' });

    expect(written.sort()).toEqual(['motto', 'siteName']);
    expect(await bestand()).toEqual({ siteName: 'SwissHub', motto: 'Zäme hock, zäme zocke' });
  });

  it('aktualisiert vorhandene Datensätze, ohne Duplikate zu erzeugen', async () => {
    await updateSettings({ siteName: 'SwissHub' });
    await updateSettings({ siteName: 'SwissHub Verein' });

    const rows = await testPrisma.globalSetting.findMany({ where: { key: 'siteName' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe('SwissHub Verein');
  });

  it('trägt die passende Gruppe am Datensatz ein', async () => {
    await updateSettings({ footerNote: 'Hinweis', maintenanceMode: true });

    const rows = await testPrisma.globalSetting.findMany({ orderBy: { key: 'asc' } });
    expect(rows.map((row) => [row.key, row.group])).toEqual([
      ['footerNote', 'footer'],
      ['maintenanceMode', 'betrieb'],
    ]);
  });

  it('lässt alle übrigen Einstellungen unangetastet', async () => {
    // Ausgangslage: gepflegte Werte in mehreren Gruppen.
    await updateSettings({
      siteName: 'SwissHub',
      discordInviteUrl: 'https://discord.gg/swisshub',
      communityStats: [{ id: 's1', label: 'Mitglieder', value: '480+', description: '', published: true }],
    });

    // Eine einzige Gruppe speichern – so, wie es die Server Action tut.
    const patch = parseSettingsPatch({ footerText: 'Neuer Text', footerNote: '' });
    expect(patch.success).toBe(true);
    if (!patch.success) return;
    await updateSettings(patch.data);

    const nachher = await bestand();
    expect(nachher.discordInviteUrl).toBe('https://discord.gg/swisshub');
    expect(nachher.siteName).toBe('SwissHub');
    expect(nachher.communityStats).toHaveLength(1);
    expect(nachher.footerText).toBe('Neuer Text');
  });

  it('schreibt bei einer leeren Änderung nichts', async () => {
    const written = await updateSettings({});
    expect(written).toEqual([]);
    expect(await testPrisma.globalSetting.count()).toBe(0);
  });

  it('speichert zusammengehörige Werte atomar – ein Fehler hinterlässt nichts', async () => {
    // Ein Wert, den PostgreSQL für eine JSON-Spalte nicht annimmt, bricht die
    // Transaktion ab. Danach darf auch der gültige Teil nicht in der Datenbank
    // stehen.
    await expect(
      updateSettings({ siteName: 'SwissHub', motto: undefined as never, tagline: Symbol('x') as never }),
    ).rejects.toBeTruthy();

    expect(await testPrisma.globalSetting.count()).toBe(0);
  });
});

describe('Einstellungen lesen', () => {
  it('ergänzt fehlende Werte mit den Standardwerten', async () => {
    await updateSettings({ siteName: 'SwissHub Verein' });
    invalidateTags(CacheTag.settings);

    const settings = await getSettings();
    expect(settings.siteName).toBe('SwissHub Verein');
    // Nicht gepflegt, also Standard – aber nicht in der Datenbank abgelegt.
    expect(settings.motto).toBe('Zäme hock, zäme zocke');
    expect(await testPrisma.globalSetting.count()).toBe(1);
  });

  it('zeigt einen gespeicherten Wert nach dem Leeren des Zwischenspeichers sofort', async () => {
    await updateSettings({ motto: 'Erste Fassung' });
    expect((await getSettings()).motto).toBe('Erste Fassung');

    // `updateSettings` leert den Zwischenspeicher selbst – der nächste Aufruf
    // liest also den neuen Wert, ohne dass ein Neustart nötig wäre.
    await updateSettings({ motto: 'Zweite Fassung' });
    expect((await getSettings()).motto).toBe('Zweite Fassung');
  });

  it('fällt bei einem unbrauchbaren gespeicherten Wert auf den Standard zurück', async () => {
    await testPrisma.globalSetting.create({
      data: { key: 'contactRetentionDays', group: 'kontakt', value: 'kaputt' },
    });
    await testPrisma.globalSetting.create({ data: { key: 'siteName', group: 'allgemein', value: 'SwissHub' } });
    invalidateTags(CacheTag.settings);

    const settings = await getSettings();
    expect(settings.contactRetentionDays).toBe(730);
    // Der gültige Nachbarwert bleibt erhalten – ein Fehler legt nicht alles lahm.
    expect(settings.siteName).toBe('SwissHub');
  });
});

describe('Berechtigung', () => {
  it('erlaubt das Speichern nur mit der Berechtigung für Einstellungen', () => {
    const superadmin = { isSuperAdmin: true, permissions: new Set<string>() };
    const redaktion = {
      isSuperAdmin: false,
      permissions: new Set<string>(ROLE_CATALOGUE.find((role) => role.key === 'redaktion')?.permissions ?? []),
    };

    expect(userHasPermission(superadmin as never, PERMISSIONS.SETTINGS_MANAGE)).toBe(true);
    expect(userHasPermission(redaktion as never, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
    expect(userHasPermission(null, PERMISSIONS.SETTINGS_MANAGE)).toBe(false);
  });

  it('führt die Berechtigung nur über Rollen, die sie wirklich enthalten', () => {
    const mitRecht = ROLE_CATALOGUE.filter((role) =>
      (role.permissions as readonly string[]).includes(PERMISSIONS.SETTINGS_MANAGE),
    );

    expect(mitRecht.length).toBeGreaterThan(0);
    for (const role of mitRecht) {
      const user = { isSuperAdmin: false, permissions: new Set<string>(role.permissions) };
      expect(userHasPermission(user as never, PERMISSIONS.SETTINGS_MANAGE), role.key).toBe(true);
    }
  });
});
