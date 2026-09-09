import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEYS, parseSettingsPatch, settingsSchema } from '@/lib/settings';

/**
 * Die Prüfung einer Einstellungsgruppe darf ausschliesslich die tatsächlich
 * übermittelten Felder betreffen.
 *
 * Hintergrund: Zuvor lief das über `settingsSchema.partial()`. Da jedes Feld
 * einen Standardwert trägt, setzte ein teilweises Schema diesen für jeden
 * fehlenden Schlüssel ein – das Speichern einer Gruppe schrieb dadurch alle
 * Einstellungen und setzte alles andere auf die Standardwerte zurück. Diese
 * Tests halten genau das fest.
 */

describe('parseSettingsPatch', () => {
  it('gibt ausschliesslich die übergebenen Schlüssel zurück', () => {
    const result = parseSettingsPatch({ footerText: 'Neuer Text', footerNote: '' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.data)).toEqual(['footerText', 'footerNote']);
  });

  it('setzt keine Standardwerte für nicht übermittelte Felder ein', () => {
    // Der eigentliche Regressionstest: Ein teilweises Schema lieferte hier
    // alle 27 Schlüssel und löschte damit u. a. die Community-Zahlen.
    const result = parseSettingsPatch({ footerNote: 'Hinweis' });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(Object.keys(result.data)).toHaveLength(1);
    for (const key of ['communityStats', 'discordInviteUrl', 'siteName', 'maintenanceMode'] as const) {
      expect(result.data, `${key} darf nicht mitgeschrieben werden`).not.toHaveProperty(key);
    }
  });

  it('zeigt, dass ein teilweises Schema genau das nicht leisten würde', () => {
    // Dokumentiert das Verhalten der Bibliothek, damit der Weg nicht
    // versehentlich zurückgebaut wird.
    const viaPartial = settingsSchema.partial().parse({ footerNote: 'Hinweis' });
    expect(Object.keys(viaPartial).length).toBeGreaterThan(1);
    expect(viaPartial.communityStats).toEqual([]);
  });

  it('übernimmt einen leeren optionalen Wert unverändert', () => {
    const result = parseSettingsPatch({ mailReplyTo: '', footerNote: '' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ mailReplyTo: '', footerNote: '' });
  });

  it('behandelt Wahrheitswerte und Zahlen korrekt', () => {
    const result = parseSettingsPatch({
      maintenanceMode: true,
      cookieBannerEnabled: false,
      contactRetentionDays: 365,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ maintenanceMode: true, cookieBannerEnabled: false, contactRetentionDays: 365 });
  });

  it('nimmt null für das Sharing-Bild an', () => {
    const result = parseSettingsPatch({ seoDefaultImageId: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.seoDefaultImageId).toBeNull();
  });

  it('verarbeitet Schweizer Umlaute und Sonderzeichen unverändert', () => {
    const text = 'Zäme hock, zäme zocke – Grüezi & tschüss «SwissHub» ß';
    const result = parseSettingsPatch({ motto: text });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.motto).toBe(text);
  });

  it('behält mehrzeilige Texte', () => {
    const result = parseSettingsPatch({ legalAddress: 'Musterweg 1\n8000 Zürich' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.legalAddress).toBe('Musterweg 1\n8000 Zürich');
  });
});

describe('parseSettingsPatch: Fehler', () => {
  it('meldet einen leeren Pflichtwert feldbezogen und auf Deutsch', () => {
    const result = parseSettingsPatch({ siteName: '' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.siteName).toBe('Bitte gib einen Namen für die Website an.');
  });

  it('meldet zu lange Eingaben mit der zulässigen Länge', () => {
    const result = parseSettingsPatch({ motto: 'x'.repeat(121) });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.motto).toContain('120 Zeichen');
  });

  it('weist unbekannte Schlüssel zurück, statt sie still zu schlucken', () => {
    const result = parseSettingsPatch({ isSuperAdmin: true });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors.isSuperAdmin).toBe('Diese Einstellung ist nicht bekannt.');
  });

  it('lässt bei einem Fehler nichts durch – es wird nichts halb gespeichert', () => {
    const result = parseSettingsPatch({ footerNote: 'gültig', siteName: '' });
    expect(result.success).toBe(false);
  });

  it('begrenzt die Aufbewahrungsfrist verständlich', () => {
    const zuGross = parseSettingsPatch({ contactRetentionDays: 99_999 });
    expect(zuGross.success).toBe(false);
    if (zuGross.success) return;
    expect(zuGross.fieldErrors.contactRetentionDays).toContain('3650');
  });
});

describe('Einstellungsschema', () => {
  it('kennt jede Einstellung mit einer Gruppe', async () => {
    const { SETTINGS_GROUPS } = await import('@/lib/settings');
    for (const key of SETTINGS_KEYS) {
      expect(SETTINGS_GROUPS[key], `Gruppe fehlt für ${key}`).toBeTruthy();
    }
  });

  it('liefert vollständige Standardwerte', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual([...SETTINGS_KEYS].sort());
    expect(DEFAULT_SETTINGS.communityStats).toEqual([]);
    expect(DEFAULT_SETTINGS.maintenanceMode).toBe(false);
  });
});
