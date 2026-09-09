/**
 * Technische Hintergrundebenen.
 *
 * Reines CSS: feine Raster, langsam wandernde Lichtflächen und ein dezenter
 * Signalstrich. Es gibt kein Canvas, kein WebGL und kein Bild – die Ebenen
 * bewegen sich ausschliesslich über `transform` und werden ausserhalb des
 * Sichtbereichs automatisch angehalten (`data-ambient`).
 *
 * Alle Ebenen sind dekorativ und für Hilfstechnologien ausgeblendet.
 */

type Variant = 'hero' | 'section' | 'soft' | 'panel';

export function TechBackdrop({ variant = 'section', className = '' }: { variant?: Variant; className?: string }) {
  if (variant === 'hero') {
    return (
      <div
        data-ambient
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      >
        {/* Grundverlauf */}
        <div className="absolute inset-0 hero-veil" />

        {/* Koordinatenraster */}
        <div className="absolute inset-0 tech-grid opacity-70" />

        {/* Wandernde Lichtflächen */}
        <div className="glow-orb glow-brand drift-slow -left-[12%] -top-[28%] h-[36rem] w-[36rem] opacity-45" />
        <div className="glow-orb glow-tech drift-slower -right-[8%] top-[10%] h-[28rem] w-[28rem] opacity-25" />

        {/* Signalstrich, der einmal langsam durchläuft */}
        <div className="absolute inset-x-0 top-1/3 h-px overflow-hidden">
          <div className="sweep h-px w-1/3 bg-gradient-to-r from-transparent via-[var(--color-brand-text)] to-transparent opacity-0" />
        </div>

        {/* Weicher Abschluss nach unten, damit der Übergang zur Seite ruhig bleibt */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--color-canvas)]" />
      </div>
    );
  }

  if (variant === 'panel') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] tech-grid-fine opacity-60 ${className}`}
      />
    );
  }

  if (variant === 'soft') {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden tech-dots opacity-40 ${className}`}
      />
    );
  }

  return (
    <div
      data-ambient
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 tech-dots opacity-45" />
      {/* Position ohne Tailwind-Translate, damit die Drift-Animation nicht
          mit einer Transform-Utility kollidiert. */}
      <div className="glow-orb glow-brand drift-slower left-[calc(50%-15rem)] top-[calc(50%-15rem)] h-[30rem] w-[30rem] opacity-20" />
    </div>
  );
}
