import type { ReactNode } from 'react';
import { Icons, type IconName } from '@/components/ui/Icon';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Reveal } from '@/components/visual/Reveal';

/**
 * Kopfbereich der Unterseiten.
 *
 * Nimmt die Bildsprache der Startseite auf – technischer Hintergrund, feine
 * Raster, ruhige Lichtflächen – bleibt aber flacher, damit der eigentliche
 * Inhalt früh sichtbar ist. Auch auf Smartphones nimmt der Bereich nie mehr
 * als einen Bildschirm ein.
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
  signals?: HeroSignal[];
  children?: ReactNode;
};

export function PageHero({ eyebrow, title, lead, icon, signals, children }: PageHeroProps) {
  const Icon = icon ? Icons[icon] : null;

  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--color-line)]">
      <TechBackdrop variant="hero" />

      <div className="shell relative py-14 sm:py-20">
        <Reveal>
          <p className="eyebrow">
            {Icon ? <Icon size={14} /> : null}
            {eyebrow}
          </p>
        </Reveal>

        <Reveal index={1}>
          <h1 className="heading-xl max-w-3xl">{title}</h1>
        </Reveal>

        {lead ? (
          <Reveal index={2}>
            <p className="lead mt-5">{lead}</p>
          </Reveal>
        ) : null}

        {signals && signals.length > 0 ? (
          <Reveal index={3}>
            <ul className="mt-8 flex flex-wrap gap-2.5">
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
    </section>
  );
}
