import type { ReactNode } from 'react';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal } from '@/components/visual/Reveal';

/**
 * Gemeinsamer Rahmen für alle Abschnitte der Website.
 *
 * Sorgt für den durchgehenden Seitenfluss: kontrollierte Hintergrundwechsel,
 * schräg angeschnittene Flächen, grosse halbtransparente Typografie im
 * Hintergrund und eine Verbindungslinie zwischen den Bereichen.
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
  /** Schräg angeschnittene Ober- oder Unterkante. */
  cut?: 'top' | 'bottom' | 'both';
  /** Grosses, halbtransparentes Wort im Hintergrund. */
  ghost?: string;
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
  cut,
  ghost,
  className = '',
  id,
  ariaLabelledBy,
}: SectionShellProps) {
  const bordered = tone !== 'default' && !cut;
  const cutClass = cut === 'top' ? 'cut-top' : cut === 'bottom' ? 'cut-bottom' : cut === 'both' ? 'cut-both' : '';

  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledBy}
      className={`relative isolate overflow-hidden ${TONE_SURFACE[tone]} ${cutClass} ${
        bordered ? 'border-y border-[var(--color-line)]' : ''
      } ${className}`}
    >
      {tone === 'tech' ? <TechBackdrop variant="soft" /> : null}

      {/* Grosses Wort im Hintergrund, das sich beim Scrollen langsamer bewegt. */}
      {ghost ? (
        <span
          aria-hidden="true"
          data-scroll-parallax="70"
          className="ghost-type absolute -right-8 top-0 -z-10 -translate-y-[42%] opacity-[0.13] sm:right-2"
        >
          {ghost}
        </span>
      ) : null}

      {connect ? (
        <span
          aria-hidden="true"
          data-reveal="line-y"
          className="connector absolute left-1/2 top-0 h-14 -translate-x-1/2 -translate-y-1/2"
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

/**
 * Abschnittskopf mit grosser Nummer.
 *
 * Nummer und Label kommen bewusst aus einer anderen Richtung als die
 * Überschrift – dadurch entsteht beim Scrollen ein spürbarer Rhythmus statt
 * eines gleichförmigen Einblendens.
 */
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
      className={`mb-10 flex flex-col gap-6 sm:mb-14 ${
        action && !centered ? 'sm:flex-row sm:items-end sm:justify-between' : ''
      }`}
    >
      <div className={`max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
        {index || eyebrow ? (
          <Reveal
            variant={centered ? 'fade' : 'left'}
            className={`mb-4 flex items-center gap-4 ${centered ? 'justify-center' : ''}`}
          >
            {index ? <span className="index-xl">{String(index).padStart(2, '0')}</span> : null}
            {eyebrow ? (
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-[var(--color-brand)]" />
                <span className="meta-brand">{eyebrow}</span>
              </span>
            ) : null}
          </Reveal>
        ) : null}

        {headline ? (
          <Reveal variant="mask" index={1}>
            <h2 id={id} className="display-1">
              {headline}
            </h2>
          </Reveal>
        ) : null}

        {intro ? (
          <Reveal index={2}>
            <p className={`lead mt-4 ${centered ? 'mx-auto' : ''}`}>{intro}</p>
          </Reveal>
        ) : null}
      </div>

      {action ? (
        <Reveal variant="right" index={2} className="shrink-0">
          {action}
        </Reveal>
      ) : null}
    </div>
  );
}
