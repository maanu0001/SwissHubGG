import { describe, expect, it } from 'vitest';
import { daysUntil, formatCountdown } from '@/lib/format';
import { revealProps } from '@/components/visual/Reveal';

/**
 * Prüfungen rund um Bewegung und Countdown.
 *
 * Wichtig ist vor allem, dass nie eine Angabe entsteht, die es in den Daten
 * nicht gibt: kein Countdown ohne Termin, keiner für die Vergangenheit.
 */

describe('Countdown', () => {
  const now = new Date('2026-09-09T10:00:00+02:00');

  it('zählt ganze Kalendertage in Schweizer Zeit', () => {
    expect(daysUntil('2026-09-09T23:30:00+02:00', now)).toBe(0);
    expect(daysUntil('2026-09-10T01:00:00+02:00', now)).toBe(1);
    expect(daysUntil('2026-09-21T15:00:00+02:00', now)).toBe(12);
  });

  it('nennt heute und morgen beim Namen', () => {
    expect(formatCountdown('2026-09-09T20:00:00+02:00', now)).toBe('Heute');
    expect(formatCountdown('2026-09-10T20:00:00+02:00', now)).toBe('Morgen');
    expect(formatCountdown('2026-09-21T15:00:00+02:00', now)).toBe('in 12 Tagen');
  });

  it('gibt ohne echten zukünftigen Termin nichts aus', () => {
    expect(formatCountdown(null, now)).toBeNull();
    expect(formatCountdown(undefined, now)).toBeNull();
    // Vergangenheit
    expect(formatCountdown('2026-09-01T15:00:00+02:00', now)).toBeNull();
    // Zu weit entfernt, um als Countdown sinnvoll zu sein
    expect(formatCountdown('2027-09-01T15:00:00+02:00', now)).toBeNull();
  });
});

describe('Reveal', () => {
  it('setzt den Versatz nach Position', () => {
    expect(revealProps('up', 0).style).toMatchObject({ '--reveal-delay': '0ms' });
    expect(revealProps('up', 2).style).toMatchObject({ '--reveal-delay': '140ms' });
  });

  it('deckelt den Versatz, damit lange Listen nicht nachhinken', () => {
    expect(revealProps('up', 50).style).toMatchObject({ '--reveal-delay': '420ms' });
  });

  it('gibt die Variante als Attribut aus', () => {
    expect(revealProps('left')['data-reveal']).toBe('left');
  });
});
