import { describe, expect, it } from 'vitest';
import {
  resolveSocialPlatform,
  showSocialFilters,
  socialFilterPlatforms,
} from '@/lib/content/socialFilters';

/**
 * Ein Filter darf nie ins Leere führen. Geprüft wird deshalb vor allem, was
 * passiert, wenn gepflegte Kanäle und vorhandene Beiträge auseinanderlaufen –
 * der Normalfall, solange noch nicht jeder Kanal kuratierte Beiträge hat.
 */

describe('Filter aus vorhandenen Beiträgen', () => {
  it('lässt Kanäle ohne Beiträge weg', () => {
    expect(
      socialFilterPlatforms(['DISCORD', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE'], ['INSTAGRAM', 'YOUTUBE']),
    ).toEqual(['INSTAGRAM', 'YOUTUBE']);
  });

  it('behält die Reihenfolge der gepflegten Kanäle bei', () => {
    expect(socialFilterPlatforms(['YOUTUBE', 'DISCORD', 'INSTAGRAM'], ['INSTAGRAM', 'YOUTUBE'])).toEqual([
      'YOUTUBE',
      'INSTAGRAM',
    ]);
  });

  it('nimmt Beiträge ohne zugehörigen Kanal trotzdem auf', () => {
    // Kanal deaktiviert oder gelöscht, Beiträge weiterhin veröffentlicht.
    expect(socialFilterPlatforms(['INSTAGRAM'], ['INSTAGRAM', 'TWITCH'])).toEqual(['INSTAGRAM', 'TWITCH']);
  });

  it('erzeugt keine Dubletten', () => {
    expect(socialFilterPlatforms(['INSTAGRAM', 'INSTAGRAM'], ['INSTAGRAM'])).toEqual(['INSTAGRAM']);
  });

  it('liefert ohne Beiträge nichts', () => {
    expect(socialFilterPlatforms(['DISCORD', 'TIKTOK'], [])).toEqual([]);
  });
});

describe('Anzeige der Filterzeile', () => {
  it('bleibt ohne Beiträge aus', () => {
    expect(showSocialFilters([])).toBe(false);
  });

  it('bleibt bei einer einzigen Plattform aus – „Alle“ wäre dasselbe', () => {
    expect(showSocialFilters(['INSTAGRAM'])).toBe(false);
  });

  it('erscheint ab zwei Plattformen', () => {
    expect(showSocialFilters(['INSTAGRAM', 'YOUTUBE'])).toBe(true);
  });
});

describe('Aktiver Filter', () => {
  const vorhanden = ['INSTAGRAM', 'YOUTUBE'] as const;

  it('nimmt eine vorhandene Plattform an, auch in Kleinschreibung', () => {
    expect(resolveSocialPlatform('youtube', [...vorhanden])).toBe('YOUTUBE');
    expect(resolveSocialPlatform('YouTube', [...vorhanden])).toBe('YOUTUBE');
  });

  it('fällt auf „Alle“ zurück, wenn die Plattform keine Beiträge hat', () => {
    // Genau der Fall aus einem alten Lesezeichen: Der Kanal besteht, seine
    // Beiträge sind aber zurückgezogen.
    expect(resolveSocialPlatform('tiktok', [...vorhanden])).toBeNull();
  });

  it('fällt bei Unsinn und ohne Angabe auf „Alle“ zurück', () => {
    for (const wert of ['quatsch', '', undefined]) {
      expect(resolveSocialPlatform(wert, [...vorhanden]), String(wert)).toBeNull();
    }
  });

  it('wählt ohne vorhandene Plattformen nie etwas aus', () => {
    expect(resolveSocialPlatform('instagram', [])).toBeNull();
  });
});
