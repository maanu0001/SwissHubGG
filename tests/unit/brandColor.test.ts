import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRAND_COLOR,
  brandColorStyles,
  contrastRatio,
  deriveBrandPalette,
  normaliseBrandColor,
  parseHexColor,
} from '@/lib/brandColor';

/**
 * Die Akzentfarbe darf ausschliesslich Farben verändern – und muss dabei in
 * beiden Darstellungen lesbar bleiben. Geprüft wird deshalb vor allem der
 * Kontrast der abgeleiteten Werte.
 */

/** Kontrast zweier Hexwerte. */
function kontrast(a: string, b: string): number {
  return contrastRatio(parseHexColor(a)!, parseHexColor(b)!);
}

const DUNKLE_FLAECHE = '#101219';
const HELLE_FLAECHE = '#ffffff';

describe('Eingabe prüfen', () => {
  it('nimmt gültige Hexwerte an und normiert sie', () => {
    expect(normaliseBrandColor('#83060A')).toBe('#83060a');
    expect(normaliseBrandColor('83060a')).toBe('#83060a');
    expect(normaliseBrandColor('#abc')).toBe('#aabbcc');
    expect(normaliseBrandColor('  #1d4ed8  ')).toBe('#1d4ed8');
  });

  it('lehnt alles andere ab', () => {
    for (const wert of ['rot', 'rgb(1,2,3)', '#12345', '#gggggg', '', 'javascript:alert(1)', '#83060a;}']) {
      expect(normaliseBrandColor(wert), wert).toBeNull();
    }
  });
});

describe('Abgeleitete Palette', () => {
  it('behält die Standardfarbe unverändert bei', () => {
    expect(deriveBrandPalette(DEFAULT_BRAND_COLOR).brand).toBe('#83060a');
  });

  it('staffelt die Markenfarbe von dunkel nach hell', () => {
    const p = deriveBrandPalette(DEFAULT_BRAND_COLOR);
    const hell = (h: string) => parseHexColor(h)!.r + parseHexColor(h)!.g + parseHexColor(h)!.b;

    expect(hell(p.deep)).toBeLessThan(hell(p.brand));
    expect(hell(p.brand)).toBeLessThan(hell(p.strong));
    expect(hell(p.strong)).toBeLessThan(hell(p.bright));
  });

  it('erreicht für jede Farbwahl den geforderten Kontrast', () => {
    const farben = ['#83060A', '#1d4ed8', '#16a34a', '#f59e0b', '#eab308', '#7c3aed', '#0f172a', '#ffffff', '#000000'];

    for (const farbe of farben) {
      const p = deriveBrandPalette(farbe);

      expect(kontrast(p.contrast, p.brand), `Schrift auf Markenfläche bei ${farbe}`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(p.textDark, DUNKLE_FLAECHE), `Markentext dunkel bei ${farbe}`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(p.textLight, HELLE_FLAECHE), `Markentext hell bei ${farbe}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('hält die Markenflächen zurückhaltend – dunkel dunkel, hell hell', () => {
    const p = deriveBrandPalette('#1d4ed8');
    expect(kontrast(p.softDark, DUNKLE_FLAECHE)).toBeLessThan(2);
    expect(kontrast(p.softLight, HELLE_FLAECHE)).toBeLessThan(2);
  });

  it('erfindet bei einer unbunten Farbe keinen Farbton', () => {
    const p = deriveBrandPalette('#666666');
    const { r, g, b } = parseHexColor(p.textLight)!;
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
  });

  it('fällt bei einer unbrauchbaren Eingabe auf die Standardfarbe zurück', () => {
    expect(deriveBrandPalette('kaputt').brand).toBe('#83060a');
  });
});

describe('Ausgegebenes Stylesheet', () => {
  const css = brandColorStyles('#1d4ed8');

  it('setzt ausschliesslich Markenmerkmale', () => {
    const merkmale = [...css.matchAll(/--[a-z-]+:/g)].map((m) => m[0]);
    expect(merkmale.length).toBeGreaterThan(0);
    for (const m of merkmale) expect(m, m).toMatch(/^--color-brand/);
  });

  it('versorgt beide Darstellungen", ohne den Rest anzufassen', () => {
    expect(css).toContain(':root{');
    expect(css).toContain("html[data-theme='light']{");
    // Keine Abstände, Grössen, Schriften oder Bewegungen.
    expect(css).not.toMatch(/margin|padding|font|width|height|transition|animation|display/);
  });

  it('enthält keine Angaben, die aus der Regel ausbrechen könnten', () => {
    const bösartig = brandColorStyles('#83060a;} body{display:none}');
    expect(bösartig).not.toContain('display:none');
    expect(bösartig).toContain('--color-brand:#83060a;');
  });
});
