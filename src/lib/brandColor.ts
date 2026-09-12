/**
 * Ableitung der Markenfarben aus einem einzigen Farbwert.
 *
 * Im Designsystem hängt die gesamte Markenwirkung an fünf Merkmalen
 * (`--color-brand`, `-strong`, `-bright`, `-soft`, `-text`) plus der Schrift
 * auf Markenflächen. Sie alle aus einem Wert zu berechnen hat zwei Gründe:
 *
 * - Es bleibt bei **einer** Einstellung im Dashboard statt sechs, die
 *   zueinander passen müssen.
 * - Die Kontraste lassen sich prüfen und nachziehen. Eine frei gewählte Farbe
 *   ergibt sonst schnell unlesbare Schrift auf der Markenfläche.
 *
 * Verändert wird ausschliesslich Farbe – keine Abstände, Grössen, Formen oder
 * Bewegungen. Ohne eigene Einstellung gilt unverändert `#83060A`.
 */

export const DEFAULT_BRAND_COLOR = '#83060A';

/** Flächen, gegen die geprüft wird – die dunkelste bzw. hellste Kartenfläche. */
const DARK_SURFACE = { r: 0x10, g: 0x12, b: 0x19 };
const LIGHT_SURFACE = { r: 0xff, g: 0xff, b: 0xff };

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export type BrandPalette = {
  /** Grundfarbe – Flächen von Schaltflächen, Akzentlinien, aktive Zustände. */
  brand: string;
  /** Etwas heller: Verläufe und Hover-Zustände. */
  strong: string;
  /** Am hellsten: Lichter, Leuchtflächen, feine Kanten. */
  bright: string;
  /** Dunkler Rand des Verlaufs auf Schaltflächen. */
  deep: string;
  /** Schrift auf einer Markenfläche – Weiss oder sehr dunkel. */
  contrast: string;
  /** Zurückhaltende Markenfläche, je Darstellung. */
  softDark: string;
  softLight: string;
  /** Markenfarbe als Schriftfarbe, je Darstellung. */
  textDark: string;
  textLight: string;
};

// ---------------------------------------------------------------------------
// Farbumrechnung
// ---------------------------------------------------------------------------

/** Akzeptiert `#rgb` und `#rrggbb`; alles andere ergibt `null`. */
export function parseHexColor(value: string): Rgb | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;

  const hex = match[1] as string;
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  const h =
    max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;

  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const value = l * 255;
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const hn = h / 360;
  return { r: channel(hn + 1 / 3) * 255, g: channel(hn) * 255, b: channel(hn - 1 / 3) * 255 };
}

function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function clampLightness(hsl: Hsl, l: number): Hsl {
  return { ...hsl, l: Math.min(1, Math.max(0, l)) };
}

/**
 * Verschiebt die Helligkeit so weit, bis der geforderte Kontrast erreicht ist.
 *
 * `step` gibt die Richtung vor: positiv heller, negativ dunkler. Wird der Wert
 * auch am Ende nicht erreicht, gilt die letzte Stufe – heller als Weiss oder
 * dunkler als Schwarz geht nicht.
 */
function ensureContrast(base: Hsl, background: Rgb, target: number, step: number): string {
  let current = base;

  for (let i = 0; i < 60; i += 1) {
    const rgb = hslToRgb(current);
    if (contrastRatio(rgb, background) >= target) return toHex(rgb);

    const next = current.l + step;
    if (next <= 0 || next >= 1) break;
    current = clampLightness(current, next);
  }

  return toHex(hslToRgb(current));
}

// ---------------------------------------------------------------------------
// Ableitung
// ---------------------------------------------------------------------------

/**
 * Leitet die vollständige Markenpalette ab.
 *
 * Die Abstände zur Grundfarbe entsprechen denen des ursprünglichen Rots: Die
 * Standardfarbe ergibt damit praktisch dieselben Werte wie zuvor von Hand
 * gesetzt.
 */
export function deriveBrandPalette(input: string): BrandPalette {
  const rgb = parseHexColor(input) ?? (parseHexColor(DEFAULT_BRAND_COLOR) as Rgb);
  const hsl = rgbToHsl(rgb);

  const brand = toHex(rgb);
  const strong = toHex(hslToRgb(clampLightness(hsl, hsl.l + 0.08)));
  const bright = toHex(hslToRgb(clampLightness(hsl, hsl.l + 0.16)));
  const deep = toHex(hslToRgb(clampLightness(hsl, hsl.l - 0.05)));

  // Schrift auf der Markenfläche: Weiss, solange es trägt – sonst sehr dunkel.
  const white = { r: 255, g: 255, b: 255 };
  const near = hslToRgb({ h: hsl.h, s: Math.min(hsl.s, 0.4), l: 0.08 });
  const contrast = contrastRatio(rgb, white) >= 4.5 || contrastRatio(rgb, white) >= contrastRatio(rgb, near)
    ? '#ffffff'
    : toHex(near);

  return {
    brand,
    strong,
    bright,
    deep,
    contrast,
    // Dunkle Darstellung: sehr dunkle Markenfläche, helle Markenschrift.
    softDark: toHex(hslToRgb({ h: hsl.h, s: Math.min(hsl.s, 0.75), l: 0.08 })),
    textDark: ensureContrast({ h: hsl.h, s: Math.min(hsl.s, 0.95), l: 0.71 }, DARK_SURFACE, 4.5, 0.02),
    // Helle Darstellung: sehr helle Markenfläche, dunkle Markenschrift.
    softLight: toHex(hslToRgb({ h: hsl.h, s: Math.min(hsl.s, 0.6), l: 0.955 })),
    // Eine unbunte Grundfarbe bleibt unbunt – sonst entstünde ein Farbstich,
    // den niemand ausgewählt hat.
    textLight: ensureContrast(
      { h: hsl.h, s: hsl.s === 0 ? 0 : Math.max(hsl.s, 0.5), l: 0.3 },
      LIGHT_SURFACE,
      4.5,
      -0.02,
    ),
  };
}

/**
 * Die Merkmale als Stylesheet – eine Regel für beide Darstellungen.
 *
 * Wird im Wurzel-Layout ausgegeben und überschreibt ausschliesslich die
 * Markenmerkmale. Alles andere im Designsystem bleibt unberührt.
 */
export function brandColorStyles(input: string): string {
  const palette = deriveBrandPalette(input);

  return [
    ':root{',
    `--color-brand:${palette.brand};`,
    `--color-brand-strong:${palette.strong};`,
    `--color-brand-bright:${palette.bright};`,
    `--color-brand-deep:${palette.deep};`,
    `--color-brand-contrast:${palette.contrast};`,
    `--color-brand-soft:${palette.softDark};`,
    `--color-brand-text:${palette.textDark};`,
    '}',
    "html[data-theme='light']{",
    `--color-brand-soft:${palette.softLight};`,
    `--color-brand-text:${palette.textLight};`,
    '}',
  ].join('');
}

/** Prüft eine Eingabe aus dem Dashboard und gibt sie normiert zurück. */
export function normaliseBrandColor(value: string): string | null {
  const rgb = parseHexColor(value);
  return rgb ? toHex(rgb) : null;
}
