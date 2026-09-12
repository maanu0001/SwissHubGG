'use client';

import { useState } from 'react';
import { DEFAULT_BRAND_COLOR, deriveBrandPalette, normaliseBrandColor } from '@/lib/brandColor';

/**
 * Auswahl der Akzentfarbe mit sofortiger Vorschau.
 *
 * Die Vorschau rechnet mit derselben Funktion wie der Server – was hier zu
 * sehen ist, entsteht nach dem Speichern genauso auf der Website. Verändert
 * wird ausschliesslich Farbe; Abstände, Formen und Bewegungen bleiben gleich.
 *
 * Gespeichert wird der Wert des Textfelds. Farbwähler und Textfeld halten sich
 * gegenseitig aktuell, damit auch eine eingetippte Angabe zählt.
 */
export function BrandColorField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  const normalised = normaliseBrandColor(value);
  const palette = deriveBrandPalette(normalised ?? DEFAULT_BRAND_COLOR);
  const isDefault = (normalised ?? '').toLowerCase() === DEFAULT_BRAND_COLOR.toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="brandColorPicker" className="field-label">
            Farbe wählen
          </label>
          <input
            id="brandColorPicker"
            type="color"
            value={normalised ?? DEFAULT_BRAND_COLOR}
            onChange={(event) => setValue(event.target.value)}
            className="h-11 w-20 cursor-pointer rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] p-1"
            aria-label="Akzentfarbe wählen"
          />
        </div>

        <div className="min-w-[10rem] flex-1">
          <label htmlFor="brandColor" className="field-label">
            Hexwert
          </label>
          <input
            id="brandColor"
            name="brandColor"
            type="text"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            spellCheck={false}
            className="input font-mono"
            placeholder={DEFAULT_BRAND_COLOR}
            aria-describedby="brandColor-hinweis"
          />
        </div>

        <button
          type="button"
          onClick={() => setValue(DEFAULT_BRAND_COLOR)}
          disabled={isDefault}
          className="btn-secondary"
        >
          Auf Standard zurücksetzen
        </button>
      </div>

      <p id="brandColor-hinweis" className="field-hint">
        {normalised
          ? `Standardfarbe ist ${DEFAULT_BRAND_COLOR}.`
          : 'Noch kein gültiger Wert – erwartet wird ein Hexwert wie #83060A.'}
      </p>

      {/* Vorschau: dieselben Bausteine wie auf der Website, nur in klein. */}
      <div
        style={
          {
            '--color-brand': palette.brand,
            '--color-brand-strong': palette.strong,
            '--color-brand-bright': palette.bright,
            '--color-brand-deep': palette.deep,
            '--color-brand-contrast': palette.contrast,
          } as React.CSSProperties
        }
        className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-canvas)] p-5"
      >
        <p className="meta mb-4">Vorschau</p>

        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              { name: 'Dunkel', soft: palette.softDark, text: palette.textDark, surface: '#101219', ink: '#f5f6f8' },
              { name: 'Hell', soft: palette.softLight, text: palette.textLight, surface: '#ffffff', ink: '#14161c' },
            ] as const
          ).map((mode) => (
            <div
              key={mode.name}
              style={{ backgroundColor: mode.surface, color: mode.ink }}
              className="rounded-lg border border-[var(--color-line)] p-4"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: mode.text }}>
                {mode.name}
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="btn-primary btn-sm pointer-events-none">Schaltfläche</span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: mode.soft, color: mode.text }}
                >
                  Hervorhebung
                </span>
                <span className="text-sm underline underline-offset-2" style={{ color: mode.text }}>
                  Link
                </span>
              </div>

              <span aria-hidden="true" className="mt-4 block h-0.5 w-16" style={{ backgroundColor: palette.brand }} />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--color-ink-subtle)]">
          Schrift auf Markenflächen: {palette.contrast === '#ffffff' ? 'Weiss' : palette.contrast}. Die Textfarben für
          beide Darstellungen werden so weit nachgezogen, bis sie den geforderten Kontrast erreichen.
        </p>
      </div>
    </div>
  );
}
