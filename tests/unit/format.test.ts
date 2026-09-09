import { describe, expect, it } from 'vitest';
import { formatBytes, formatDate, formatDateRange, formatNumber, slugify } from '@/lib/format';
import { toLocalInputValue, zurichOffsetMinutes } from '@/server/actions/types';

/** Formatierung und Zeitzonen sind in einem Schweizer Kontext geschäftskritisch. */
describe('Formatierung für de-CH', () => {
  it('formatiert Datumsangaben schweizerisch', () => {
    expect(formatDate(new Date('2026-04-12T10:00:00Z'))).toBe('12.04.2026');
  });

  it('zeigt für fehlende Werte einen Gedankenstrich', () => {
    expect(formatDate(null)).toBe('–');
    expect(formatNumber(null)).toBe('–');
  });

  it('formatiert Zeiträume kompakt', () => {
    const from = new Date('2026-04-12T10:00:00Z');
    const to = new Date('2026-04-14T10:00:00Z');
    expect(formatDateRange(from, to)).toBe('12.04.2026 – 14.04.2026');
    expect(formatDateRange(from, from)).toBe('12.04.2026');
    expect(formatDateRange(from, null)).toBe('ab 12.04.2026');
    expect(formatDateRange(null, to)).toBe('bis 14.04.2026');
  });

  it('formatiert Dateigrössen', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2,0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 MB');
  });
});

describe('slugify', () => {
  it('wandelt Umlaute in ihre Ersatzschreibweise um', () => {
    expect(slugify('Über uns')).toBe('ueber-uns');
    expect(slugify('Turniere & Events')).toBe('turniere-events');
    expect(slugify('Grösste Community')).toBe('groesste-community');
  });

  it('entfernt führende und schliessende Trennzeichen', () => {
    expect(slugify('  -- Hallo Welt -- ')).toBe('hallo-welt');
  });

  it('begrenzt die Länge', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('Zeitzone Europe/Zurich', () => {
  it('erkennt Winterzeit (UTC+1)', () => {
    expect(zurichOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(60);
  });

  it('erkennt Sommerzeit (UTC+2)', () => {
    expect(zurichOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(120);
  });

  it('stellt Formularwerte in Ortszeit dar', () => {
    // 12:00 UTC im Sommer entspricht 14:00 Ortszeit.
    expect(toLocalInputValue(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07-15T14:00');
  });

  it('liefert für leere Werte eine leere Zeichenkette', () => {
    expect(toLocalInputValue(null)).toBe('');
  });
});
