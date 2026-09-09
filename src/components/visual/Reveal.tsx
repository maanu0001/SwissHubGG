import type { CSSProperties, ElementType, ReactNode } from 'react';

/**
 * Einblenden beim Scrollen – als reine Server-Komponente.
 *
 * Es wird nur ein Attribut gesetzt; die Beobachtung übernimmt die zentrale
 * Bewegungs-Laufzeit (siehe `MotionRuntime`). Dadurch entsteht kein zusätzliches
 * Client-Bundle und kein Client-Boundary um Inhalte.
 *
 * Ohne JavaScript oder bei reduzierter Bewegung bleibt alles sofort sichtbar.
 */

/**
 * Die Varianten des Bewegungssystems.
 *
 * - `up`      – Standard: Inhalt steigt auf
 * - `left`/`right` – seitlicher Einsatz, z. B. für Labels und Spalten
 * - `scale`   – ruhiges Heranfahren für Flächen
 * - `fade`    – nur Einblenden, ohne Versatz
 * - `mask`    – Überschrift wird von einer Maske freigegeben
 * - `line`    – waagrechte Linie baut sich auf
 * - `line-y`  – senkrechte Verbindung baut sich auf
 * - `zoom`    – Bild fährt aus einer Überdeckung heran
 */
export type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade' | 'mask' | 'line' | 'line-y' | 'zoom';

/**
 * Attribute zum Anhängen an ein beliebiges Element – praktisch für Listen,
 * bei denen ein zusätzliches Wrapper-Element das Layout stören würde.
 *
 * @param index Position in einer Gruppe; erzeugt den leicht versetzten Einsatz.
 */
export function revealProps(
  variant: RevealVariant = 'up',
  index = 0,
  step = 70,
): { 'data-reveal': RevealVariant; style: CSSProperties } {
  // Der Versatz wird gedeckelt, damit lange Listen nicht spürbar nachhinken.
  const delay = Math.min(index * step, 420);
  return {
    'data-reveal': variant,
    style: { '--reveal-delay': `${delay}ms` } as CSSProperties,
  };
}

type RevealProps = {
  children: ReactNode;
  variant?: RevealVariant;
  index?: number;
  step?: number;
  className?: string;
  as?: ElementType;
};

export function Reveal({ children, variant = 'up', index = 0, step = 70, className, as }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const { style, ...attrs } = revealProps(variant, index, step);

  return (
    <Tag className={className} style={style} {...attrs}>
      {children}
    </Tag>
  );
}
