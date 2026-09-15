import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MediaKind } from '@prisma/client';
import { prepareSchema, resetDatabase, testPrisma } from '../setup/testDb';
import { updateSettings } from '@/lib/settings';
import { getSiteLogo } from '@/lib/siteLogo';
import { DEFAULT_LOGO } from '@/lib/brandLogo';
import { invalidateAll } from '@/lib/cache';

/**
 * Auflösung des Hauptlogos.
 *
 * Entscheidend ist nicht der Normalfall, sondern der Rückfall: Zeigt die
 * Einstellung ins Leere, muss die mitgelieferte Bildmarke erscheinen. Ein
 * leerer oder kaputter Kopfbereich wäre für Besucher deutlich schlimmer als
 * ein Logo, das kurz nicht übernommen wurde.
 */

beforeAll(() => {
  prepareSchema();
});

beforeEach(async () => {
  await resetDatabase();
  invalidateAll();
});

async function medium(overrides: Partial<{ kind: MediaKind; width: number | null; height: number | null }> = {}) {
  return testPrisma.mediaAsset.create({
    data: {
      storageKey: `media/2026/01/${Math.random().toString(36).slice(2)}.png`,
      originalName: 'logo.png',
      title: 'Logo',
      mimeType: 'image/png',
      kind: overrides.kind ?? MediaKind.IMAGE,
      byteSize: 1234,
      width: overrides.width === undefined ? 960 : overrides.width,
      height: overrides.height === undefined ? 240 : overrides.height,
      checksum: 'x'.repeat(64),
    },
    select: { id: true, storageKey: true },
  });
}

describe('Hauptlogo', () => {
  it('nimmt ohne Einstellung die mitgelieferte Bildmarke', async () => {
    const logo = await getSiteLogo();
    expect(logo.src).toBe(DEFAULT_LOGO.src);
    expect(logo.width).toBe(DEFAULT_LOGO.width);
    expect(logo.height).toBe(DEFAULT_LOGO.height);
  });

  it('liefert das gewählte Medium samt echter Abmessungen', async () => {
    const asset = await medium();
    await updateSettings({ logoMediaId: asset.id });
    invalidateAll();

    const logo = await getSiteLogo();
    expect(logo.src).toBe(`/api/media/${asset.storageKey}`);
    // Die Abmessungen halten das Seitenverhältnis fest – ohne sie liesse sich
    // das Logo nicht verzerrungsfrei darstellen.
    expect([logo.width, logo.height]).toEqual([960, 240]);
  });

  it('nennt den Namen der Website als Alternativtext', async () => {
    await updateSettings({ siteName: 'SwissHub Verein' });
    invalidateAll();

    expect((await getSiteLogo()).alt).toBe('SwissHub Verein');
  });

  it('fällt auf die Bildmarke zurück, wenn das Medium gelöscht wurde', async () => {
    const asset = await medium();
    await updateSettings({ logoMediaId: asset.id });
    await testPrisma.mediaAsset.delete({ where: { id: asset.id } });
    invalidateAll();

    expect((await getSiteLogo()).src).toBe(DEFAULT_LOGO.src);
  });

  it('fällt auf die Bildmarke zurück, wenn das Medium kein Bild ist', async () => {
    const asset = await medium({ kind: MediaKind.DOCUMENT });
    await updateSettings({ logoMediaId: asset.id });
    invalidateAll();

    expect((await getSiteLogo()).src).toBe(DEFAULT_LOGO.src);
  });

  it('nimmt bei unbekannten Abmessungen das quadratische Verhältnis an', async () => {
    const asset = await medium({ width: null, height: null });
    await updateSettings({ logoMediaId: asset.id });
    invalidateAll();

    const logo = await getSiteLogo();
    expect(logo.width).toBe(logo.height);
  });
});
