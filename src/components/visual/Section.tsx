import type { ReactNode } from 'react';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal } from '@/components/visual/Reveal';

/**
 * Gemeinsamer Rahmen für alle Abschnitte der Website.
 *
 * Sorgt für den durchgehenden Seitenfluss: kontrollierte Hintergrundwechsel,
 * eine feine Verbindungslinie zwischen den Bereichen und – wo sinnvoll – ein
 * kleines Interface-Label mit Abschnittsnummer.
 *
 * Die Varianten sind bewusst begrenzt, damit die Redaktion nicht in ein
 * beliebiges Baukastensystem gerät, sondern im SwissHub-Designsystem bleibt.
 */

export type SectionTone = 'default' | 'muted' | 'accent' | 'tech';

const TONE_SURFACE: Record<SectionTone, string> = {
  default: '',
  muted: 'bg-[var(--color-surface)]',
  accent: 'bg-[var(--color-brand-soft)]',
  tech: 'bg-[var(--color-void)]',
};

type SectionShellProps = {
  children: ReactNode;
  tone?: SectionTone;
  /** Schmalere Textspalte, z. B. für Fliesstext und FAQ. */
  narrow?: boolean;
  compact?: boolean;
  /** Feine Linie, die den Abschnitt optisch mit dem vorherigen verbindet. */
  connect?: boolean;
  className?: string;
  id?: string;
  ariaLabelledBy?: string;
};

export function SectionShell({
  children,
  tone = 'default',
  narrow = false,
  compact = false,
  connect = false,
  className = '',
  id,
  ariaLabelledBy,
}: SectionShellProps) {
  const bordered = tone !== 'default';

  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={`relative ${TONE_SURFACE[tone]} ${
        bordered ? 'border-y border-[var(--color-line)]' : ''
      } ${className}`}
    >
      {tone === 'tech' ? <TechBackdrop variant="soft" /> : null}

      {connect ? (
        <span
          aria-hidden="true"
          className="connector absolute left-1/2 top-0 h-12 -translate-x-1/2 -translate-y-1/2"
        />
      ) : null}

      <div className={`relative ${compact ? 'section-tight' : 'section'} ${narrow ? 'shell-narrow' : 'shell'}`}>
        {children}
      </div>
    </section>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  headline?: string;
  intro?: string;
  align?: 'left' | 'center';
  /** Laufende Nummer im Seitenfluss, z. B. „03“. 0 bedeutet: keine Nummer. */
  index?: number;
  /** Zusätzliche Aktion rechts neben der Überschrift (Desktop). */
  action?: ReactNode;
  id?: string;
};

export function SectionHeading({
  eyebrow,
  headline,
  intro,
  align = 'left',
  index,
  action,
  id,
}: SectionHeadingProps) {
  if (!eyebrow && !headline && !intro) return null;

  const centered = align === 'center';

  return (
    <div
      className={`mb-9 flex flex-col gap-5 sm:mb-11 ${
        action && !centered ? 'sm:flex-row sm:items-end sm:justify-between' : ''
      }`}
    >
      <Reveal className={`max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
        {eyebrow || index ? (
          <p className={`eyebrow ${centered ? 'justify-center' : ''}`}>
            {index ? <span className="text-[var(--color-ink-subtle)]">{String(index).padStart(2, '0')}</span> : null}
            <span aria-hidden="true" className="h-px w-7 bg-[var(--color-brand)]" />
            {eyebrow}
          </p>
        ) : null}

        {headline ? (
          <h2 id={id} className="heading-lg">
            {headline}
          </h2>
        ) : null}

        {intro ? <p className={`lead mt-3.5 ${centered ? 'mx-auto' : ''}`}>{intro}</p> : null}
      </Reveal>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
