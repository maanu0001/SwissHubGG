import type { ReactNode } from 'react';
import { Icons, type IconName } from '@/components/ui/Icon';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal } from '@/components/visual/Reveal';

/**
 * Kopfbereich der Unterseiten.
 *
 * Nimmt die Bildsprache der Startseite auf – technischer Hintergrund, grosse
 * Typografie, ein halbtransparentes Wort im Hintergrund – bleibt aber flacher
 * als der Hero, damit der eigentliche Inhalt früh sichtbar ist. Auch auf
 * Smartphones nimmt der Bereich nie mehr als einen Bildschirm ein.
 *
 * „Signale“ sind kleine Statusmodule. Sie zeigen ausschliesslich real
 * vorhandene Angaben; ohne Daten wird nichts angezeigt.
 */

export type HeroSignal = {
  label: string;
  value: string;
  /** Zeigt einen Aktivitätspunkt – nur bei tatsächlich laufenden Zuständen. */
  live?: boolean;
};

type PageHeroProps = {
  eyebrow: string;
  title: string;
  lead?: string;
  icon?: IconName;
  /** Grosses Wort im Hintergrund. */
  ghost?: string;
  signals?: HeroSignal[];
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, lead, icon, ghost, signals, children }: PageHeroProps) {
  const Icon = icon ? Icons[icon] : null;

  return (
    <section className="relative isolate overflow-hidden">
      <TechBackdrop variant="hero" />

      {ghost ? (
        <span
          aria-hidden="true"
          data-scroll-parallax="60"
          className="ghost-type absolute -right-16 top-1/2 -z-10 hidden -translate-y-1/2 opacity-[0.11] lg:block"
        >
          {ghost}
        </span>
      ) : null}

      <div className="shell relative pb-16 pt-16 sm:pb-20 sm:pt-20">
        <Reveal variant="left">
          <p className="eyebrow">
            {Icon ? <Icon size={14} /> : null}
            {eyebrow}
          </p>
        </Reveal>

        <Reveal variant="mask" index={1}>
          <h1 className="display-hero max-w-[18ch]">{title}</h1>
        </Reveal>

        {lead ? (
          <Reveal index={2}>
            <p className="lead mt-6">{lead}</p>
          </Reveal>
        ) : null}

        {signals && signals.length > 0 ? (
          <Reveal index={3}>
            <ul className="mt-9 flex flex-wrap gap-2.5">
              {signals.map((signal) => (
                <li
                  key={signal.label}
                  className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface)_70%,transparent)] px-4 py-2 backdrop-blur-sm"
                >
                  {signal.live ? <span className="pulse-dot text-[var(--color-success-text)]" /> : null}
                  <span className="meta">{signal.label}</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{signal.value}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ) : null}

        {children ? <Reveal index={4}>{children}</Reveal> : null}
      </div>

      {/* Diagonale Kante als sichtbarer Übergang in den Inhalt. */}
      <span aria-hidden="true" className="edge-diagonal absolute inset-x-0 bottom-0 opacity-70" />
    </section>
  );
}
