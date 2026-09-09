import { describe, expect, it } from 'vitest';
import { contactFormSchema } from '@/lib/validation/contact';
import { settingsSchema, publishedStats } from '@/lib/settings';
import { normaliseAddresses } from '@/lib/mail/queue';

describe('Kontaktformular-Validierung', () => {
  const valid = {
    name: 'Anna Muster',
    email: 'anna@example.com',
    organisation: '',
    category: 'allgemein',
    subject: 'Frage zur Community',
    message: 'Ich möchte gerne mehr über eure Turniere erfahren und wie ich mitmachen kann.',
    privacy: 'on' as const,
  };

  it('akzeptiert eine vollständige Eingabe', () => {
    const result = contactFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('verlangt eine gültige E-Mail-Adresse', () => {
    const result = contactFormSchema.safeParse({ ...valid, email: 'keine-adresse' });
    expect(result.success).toBe(false);
  });

  it('verlangt eine ausreichend lange Nachricht', () => {
    const result = contactFormSchema.safeParse({ ...valid, message: 'zu kurz' });
    expect(result.success).toBe(false);
  });

  it('verlangt die Datenschutzbestätigung', () => {
    const result = contactFormSchema.safeParse({ ...valid, privacy: false });
    expect(result.success).toBe(false);
  });

  it('begrenzt die Nachrichtenlänge', () => {
    const result = contactFormSchema.safeParse({ ...valid, message: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('wandelt eine leere Organisation in null um', () => {
    const result = contactFormSchema.parse(valid);
    expect(result.organisation).toBeNull();
  });

  it('entfernt umschliessende Leerzeichen', () => {
    const result = contactFormSchema.parse({ ...valid, name: '  Anna Muster  ' });
    expect(result.name).toBe('Anna Muster');
  });
});

describe('Einstellungen', () => {
  it('liefert für eine leere Eingabe sinnvolle Standardwerte', () => {
    const settings = settingsSchema.parse({});
    expect(settings.siteName).toBe('SwissHub');
    expect(settings.motto).toBe('Zäme hock, zäme zocke');
    expect(settings.maintenanceMode).toBe(false);
    // Nicht bestätigte Angaben bleiben bewusst leer.
    expect(settings.discordInviteUrl).toBe('');
    expect(settings.legalAddress).toBe('');
    expect(settings.communityStats).toEqual([]);
  });

  it('zeigt nur veröffentlichte Community-Zahlen an', () => {
    const settings = settingsSchema.parse({
      communityStats: [
        { id: '1', label: 'Gegründet', value: '2021', published: true },
        { id: '2', label: 'Mitglieder', value: '1234', published: false },
        { id: '3', label: 'Leer', value: '   ', published: true },
      ],
    });

    const visible = publishedStats(settings);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.label).toBe('Gegründet');
  });

  it('begrenzt die Anzahl der Community-Zahlen', () => {
    const stats = Array.from({ length: 7 }, (_, index) => ({
      id: String(index),
      label: `Wert ${index}`,
      value: String(index),
      published: true,
    }));

    expect(settingsSchema.safeParse({ communityStats: stats }).success).toBe(false);
  });
});

describe('E-Mail-Adressen', () => {
  it('normalisiert und entfernt Dubletten', () => {
    expect(normaliseAddresses(['Info@SwissHub.gg', 'info@swisshub.gg', ' team@swisshub.gg '])).toEqual([
      'info@swisshub.gg',
      'team@swisshub.gg',
    ]);
  });

  it('verwirft ungültige Adressen', () => {
    expect(normaliseAddresses(['keine-adresse', 'a@b', 'gut@example.com'])).toEqual(['gut@example.com']);
  });

  it('kommt mit fehlender Eingabe zurecht', () => {
    expect(normaliseAddresses(undefined)).toEqual([]);
  });
});
