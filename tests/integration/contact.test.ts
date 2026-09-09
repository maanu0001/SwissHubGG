import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prepareSchema, resetDatabase, testPrisma } from '../setup/testDb';
import { ContactStatus, MessageDirection, RecipientKind } from '@prisma/client';

/**
 * Integrationstests der Kontaktverarbeitung gegen eine echte Datenbank.
 *
 * Geprüft werden die Punkte, die im Betrieb wirklich zählen: Speicherung,
 * Empfängerrouting nach Kategorie, Rate Limiting und Anonymisierung.
 */

beforeAll(() => {
  prepareSchema();
});

beforeEach(async () => {
  await resetDatabase();
});

async function createCategories() {
  const [allgemein, sponsoring] = await Promise.all([
    testPrisma.contactCategory.create({ data: { key: 'allgemein', label: 'Allgemein', sortOrder: 1 } }),
    testPrisma.contactCategory.create({ data: { key: 'sponsoring', label: 'Sponsoring', sortOrder: 2 } }),
  ]);
  return { allgemein, sponsoring };
}

describe('Kontaktanfragen', () => {
  it('speichert eine Anfrage samt Eingangsnachricht', async () => {
    const { allgemein } = await createCategories();

    const request = await testPrisma.contactRequest.create({
      data: {
        reference: 'SH-260101-ABCDEF',
        name: 'Anna Muster',
        email: 'anna@example.com',
        subject: 'Frage zur Community',
        categoryId: allgemein.id,
        message: 'Ich interessiere mich für eure Turniere.',
        privacyAcceptedAt: new Date(),
        ipHash: 'pseudonymisiert',
        messages: {
          create: { direction: MessageDirection.INBOUND, subject: 'Frage zur Community', body: 'Ich interessiere mich für eure Turniere.' },
        },
      },
      include: { messages: true },
    });

    expect(request.status).toBe(ContactStatus.NEW);
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0]?.direction).toBe(MessageDirection.INBOUND);
  });

  it('erzwingt eindeutige Referenznummern', async () => {
    const { allgemein } = await createCategories();

    const base = {
      name: 'Anna',
      email: 'anna@example.com',
      subject: 'Betreff',
      categoryId: allgemein.id,
      message: 'Nachricht mit ausreichender Länge.',
      privacyAcceptedAt: new Date(),
    };

    await testPrisma.contactRequest.create({ data: { ...base, reference: 'SH-260101-AAAAAA' } });
    await expect(
      testPrisma.contactRequest.create({ data: { ...base, reference: 'SH-260101-AAAAAA' } }),
    ).rejects.toThrow();
  });

  it('behält Anfragen, wenn eine Kategorie gelöscht wird', async () => {
    const { allgemein } = await createCategories();

    const request = await testPrisma.contactRequest.create({
      data: {
        reference: 'SH-260101-BBBBBB',
        name: 'Anna',
        email: 'anna@example.com',
        subject: 'Betreff',
        categoryId: allgemein.id,
        message: 'Nachricht mit ausreichender Länge.',
        privacyAcceptedAt: new Date(),
      },
    });

    await testPrisma.contactCategory.delete({ where: { id: allgemein.id } });

    const reloaded = await testPrisma.contactRequest.findUnique({ where: { id: request.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.categoryId).toBeNull();
  });
});

describe('Empfängerrouting nach Kategorie', () => {
  it('wählt nur Empfänger der passenden Kategorie sowie kategorienübergreifende', async () => {
    const { allgemein, sponsoring } = await createCategories();

    const [nurSponsoring, alle] = await Promise.all([
      testPrisma.emailRecipient.create({
        data: {
          email: 'sponsoring@swisshub.gg',
          kind: RecipientKind.TO,
          categories: { create: { categoryId: sponsoring.id } },
        },
      }),
      testPrisma.emailRecipient.create({
        data: { email: 'info@swisshub.gg', kind: RecipientKind.TO, allCategories: true },
      }),
    ]);

    await testPrisma.emailRecipient.create({
      data: {
        email: 'inaktiv@swisshub.gg',
        kind: RecipientKind.TO,
        active: false,
        allCategories: true,
      },
    });

    const query = (categoryId: string) =>
      testPrisma.emailRecipient.findMany({
        where: {
          active: true,
          OR: [{ allCategories: true }, { categories: { some: { categoryId } } }],
        },
        select: { email: true },
        orderBy: { email: 'asc' },
      });

    const forSponsoring = await query(sponsoring.id);
    expect(forSponsoring.map((entry) => entry.email)).toEqual(['info@swisshub.gg', 'sponsoring@swisshub.gg']);

    const forGeneral = await query(allgemein.id);
    expect(forGeneral.map((entry) => entry.email)).toEqual(['info@swisshub.gg']);

    expect(nurSponsoring.allCategories).toBe(false);
    expect(alle.allCategories).toBe(true);
  });

  it('lässt dieselbe Adresse als TO und BCC zu, aber nicht doppelt je Typ', async () => {
    await testPrisma.emailRecipient.create({ data: { email: 'info@swisshub.gg', kind: RecipientKind.TO } });
    await testPrisma.emailRecipient.create({ data: { email: 'info@swisshub.gg', kind: RecipientKind.BCC } });

    await expect(
      testPrisma.emailRecipient.create({ data: { email: 'info@swisshub.gg', kind: RecipientKind.TO } }),
    ).rejects.toThrow();
  });
});

describe('Rate Limiting', () => {
  it('zählt pro Fenster und Kennung', async () => {
    const windowStart = new Date('2026-01-01T10:00:00Z');
    const expiresAt = new Date('2026-01-01T11:00:00Z');

    for (let index = 0; index < 3; index += 1) {
      await testPrisma.rateLimitCounter.upsert({
        where: {
          bucket_identifier_windowStart: { bucket: 'contact-form', identifier: 'hash-a', windowStart },
        },
        create: { bucket: 'contact-form', identifier: 'hash-a', windowStart, count: 1, expiresAt },
        update: { count: { increment: 1 } },
      });
    }

    const counter = await testPrisma.rateLimitCounter.findFirst({ where: { identifier: 'hash-a' } });
    expect(counter?.count).toBe(3);

    // Eine andere Kennung wird getrennt gezählt.
    await testPrisma.rateLimitCounter.upsert({
      where: {
        bucket_identifier_windowStart: { bucket: 'contact-form', identifier: 'hash-b', windowStart },
      },
      create: { bucket: 'contact-form', identifier: 'hash-b', windowStart, count: 1, expiresAt },
      update: { count: { increment: 1 } },
    });

    const other = await testPrisma.rateLimitCounter.findFirst({ where: { identifier: 'hash-b' } });
    expect(other?.count).toBe(1);
  });
});

describe('Anonymisierung', () => {
  it('entfernt personenbezogene Angaben und Anhänge, behält aber den Datensatz', async () => {
    const { allgemein } = await createCategories();

    const request = await testPrisma.contactRequest.create({
      data: {
        reference: 'SH-260101-CCCCCC',
        name: 'Anna Muster',
        email: 'anna@example.com',
        organisation: 'Beispiel AG',
        subject: 'Betreff',
        categoryId: allgemein.id,
        message: 'Eine Nachricht mit personenbezogenen Angaben.',
        privacyAcceptedAt: new Date(),
        ipHash: 'hash',
        userAgent: 'Mozilla/5.0',
        attachments: {
          create: {
            storageKey: 'private/kontakt/datei.pdf',
            originalName: 'datei.pdf',
            mimeType: 'application/pdf',
            byteSize: 1234,
            checksum: 'abc',
          },
        },
      },
    });

    await testPrisma.$transaction([
      testPrisma.contactAttachment.deleteMany({ where: { requestId: request.id } }),
      testPrisma.contactRequest.update({
        where: { id: request.id },
        data: {
          name: 'Anonymisiert',
          email: 'anonymisiert@swisshub.invalid',
          organisation: null,
          message: 'Diese Anfrage wurde anonymisiert.',
          ipHash: null,
          userAgent: null,
          anonymizedAt: new Date(),
        },
      }),
    ]);

    const anonymised = await testPrisma.contactRequest.findUnique({
      where: { id: request.id },
      include: { attachments: true },
    });

    expect(anonymised?.name).toBe('Anonymisiert');
    expect(anonymised?.organisation).toBeNull();
    expect(anonymised?.ipHash).toBeNull();
    expect(anonymised?.attachments).toHaveLength(0);
    expect(anonymised?.anonymizedAt).not.toBeNull();
    // Status und Referenz bleiben für Statistik und Nachvollziehbarkeit erhalten.
    expect(anonymised?.reference).toBe('SH-260101-CCCCCC');
  });
});
