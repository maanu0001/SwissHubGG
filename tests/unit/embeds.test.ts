import { describe, expect, it } from 'vitest';
import { resolveEmbed } from '@/lib/content/embeds';
import { normaliseMetricKey } from '@/lib/metrics';
import { MetricType } from '@prisma/client';

/** Externe Videos dürfen nur über bekannte, datenschutzfreundliche Adressen laufen. */
describe('resolveEmbed', () => {
  it('erkennt YouTube-Watch-Adressen und nutzt die nocookie-Domain', () => {
    const result = resolveEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result?.kind).toBe('youtube');
    expect(result && 'embedUrl' in result && result.embedUrl).toContain('youtube-nocookie.com');
  });

  it('erkennt Kurzadressen von YouTube', () => {
    const result = resolveEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(result?.kind).toBe('youtube');
  });

  it('erkennt Twitch-Kanäle und setzt den Parent-Parameter', () => {
    const result = resolveEmbed('https://www.twitch.tv/swisshub', 'swisshub.gg');
    expect(result?.kind).toBe('twitch');
    expect(result && 'embedUrl' in result && result.embedUrl).toContain('parent=swisshub.gg');
  });

  it('behandelt unbekannte Anbieter als einfachen Link', () => {
    const result = resolveEmbed('https://example.com/video');
    expect(result?.kind).toBe('link');
  });

  it('lehnt ungültige und unsichere Adressen ab', () => {
    expect(resolveEmbed('kein-link')).toBeNull();
    expect(resolveEmbed('javascript:alert(1)')).toBeNull();
  });
});

/** Die Statistik darf keine beliebigen Schlüssel und keine Admin-Pfade speichern. */
describe('normaliseMetricKey', () => {
  it('entfernt Query-Parameter aus Seitenpfaden', () => {
    expect(normaliseMetricKey(MetricType.PAGE_VIEW, '/turniere?status=laufend')).toBe('/turniere');
  });

  it('verwirft Admin-Pfade', () => {
    expect(normaliseMetricKey(MetricType.PAGE_VIEW, '/admin/kontakt')).toBeNull();
  });

  it('verwirft Pfade ohne führenden Schrägstrich', () => {
    expect(normaliseMetricKey(MetricType.PAGE_VIEW, 'https://example.com')).toBeNull();
  });

  it('erlaubt nur bekannte Plattformen', () => {
    expect(normaliseMetricKey(MetricType.SOCIAL_CLICK, 'twitch')).toBe('TWITCH');
    expect(normaliseMetricKey(MetricType.SOCIAL_CLICK, 'irgendwas')).toBeNull();
  });
});
