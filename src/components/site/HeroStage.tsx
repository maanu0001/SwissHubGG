import { LogoMark } from '@/components/brand/Logo';

/**
 * Inszenierung der Bildmarke im Hero.
 *
 * Das Logo selbst bleibt unverändert: gleiche Datei, festes Seitenverhältnis,
 * keine Einfärbung, kein Beschnitt. Inszeniert wird ausschliesslich der Raum
 * darum – Ringe, Knotenpunkte, Lichtkranz und ein feines Raster.
 *
 * Die Ebenen tragen `data-parallax-layer` mit unterschiedlicher Tiefe. Auf
 * Zeigegeräten folgen sie leicht der Maus; auf Touch-Geräten und bei
 * reduzierter Bewegung stehen sie still.
 */
export function HeroStage({ priority = false }: { priority?: boolean }) {
  return (
    <div
      className="relative flex aspect-square shrink-0 items-center justify-center"
      /* Rahmenbreite so gewählt, dass die Marke selbst (62 % davon) auf dem
         Desktop rund 285 px und auf Smartphones rund 160 px gross ist – und
         daneben noch Platz für Aussage und Handlungsaufforderungen bleibt. */
      style={{ width: 'clamp(16.25rem, 54vw, 28.5rem)' }}
      data-ambient
    >
      {/* Lichtkranz */}
      <span
        aria-hidden="true"
        data-parallax-layer
        style={{ '--depth': 6 } as React.CSSProperties}
        className="glow-orb glow-brand breathe absolute -inset-[12%]"
      />

      {/* Äusserer Ring mit umlaufenden Knotenpunkten */}
      <span
        aria-hidden="true"
        data-parallax-layer
        style={{ '--depth': 14 } as React.CSSProperties}
        className="absolute -inset-[7%]"
      >
        <span className="orbit-ring orbit-spin">
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--color-brand-bright)]" />
          <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-tech)]" />
        </span>
      </span>

      {/* Innerer Ring, gegenläufig */}
      <span
        aria-hidden="true"
        data-parallax-layer
        style={{ '--depth': 22 } as React.CSSProperties}
        className="absolute inset-[4%]"
      >
        <span className="orbit-ring orbit-spin-reverse border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)]">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[var(--color-brand-bright)]" />
        </span>
      </span>

      {/* Technische Fläche hinter der Marke */}
      <span
        aria-hidden="true"
        data-parallax-layer
        style={{ '--depth': 10 } as React.CSSProperties}
        className="absolute inset-[8%] rounded-[30%] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface)_45%,transparent)] backdrop-blur-sm"
      >
        <span className="absolute inset-0 rounded-[30%] tech-grid-fine opacity-60" />
      </span>

      {/* Eckmarken */}
      <span
        aria-hidden="true"
        data-parallax-layer
        style={{ '--depth': 30 } as React.CSSProperties}
        className="absolute inset-0"
      >
        {(
          [
            'left-0 top-0 border-l border-t',
            'right-0 top-0 border-r border-t',
            'left-0 bottom-0 border-b border-l',
            'right-0 bottom-0 border-b border-r',
          ] as const
        ).map((position) => (
          <span
            key={position}
            className={`absolute h-5 w-5 border-[color-mix(in_srgb,var(--color-brand)_70%,transparent)] ${position}`}
          />
        ))}
      </span>

      {/* Die Marke selbst – unverändert, scharf, im Vordergrund. */}
      <span
        data-parallax-layer
        style={{ '--depth': 34 } as React.CSSProperties}
        className="logo-entrance relative block w-[62%]"
      >
        <LogoMark size={512} priority={priority} className="h-auto w-full drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)]" />
      </span>
    </div>
  );
}
