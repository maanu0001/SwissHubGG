import Link from 'next/link';

/**
 * Ein Filter, der über die Adresse abgebildet wird.
 *
 * Filter bleiben bewusst Links mit Suchparametern: Die Auswahl ist dadurch
 * teilbar, „Zurück“ und „Vorwärts“ funktionieren, und ohne JavaScript lässt
 * sich weiterhin filtern.
 *
 * Entscheidend ist `scroll={false}`. Der Router scrollt nach einer Navigation
 * standardmässig an den Anfang der neuen Ansicht – er ruft dafür
 * `scrollIntoView()` auf den Abschnitten auf. Bei einem Filterwechsel ist das
 * falsch: Der Pfad bleibt derselbe, es ist kein Seitenwechsel, und die Ansicht
 * würde vom Filter weg an den Seitenanfang springen. Mit `scroll={false}`
 * bleibt die Scrollposition genau dort, wo sie war.
 *
 * Diese Komponente ist die einzige Stelle, an der Filter gebaut werden – neu
 * hinzukommende Status, Spiele oder Plattformen verhalten sich dadurch ohne
 * Zutun richtig.
 */

type FilterLinkProps = {
  href: string;
  active: boolean;
  children: React.ReactNode;
  /**
   * `solid` – die Hauptauswahl (Status, Plattform): gefüllte Markenfläche.
   * `tech`  – die feinere zweite Ebene (Spiele): Monospace-Marke.
   */
  variant?: 'solid' | 'tech';
};

const STYLES = {
  solid: {
    active:
      'badge border-[color-mix(in_srgb,var(--color-brand)_65%,transparent)] bg-[var(--color-brand)] px-4 py-2 font-semibold text-white shadow-[var(--shadow-card)]',
    inactive:
      'badge-neutral px-4 py-2 transition-[color,border-color,background-color] duration-200 hover:border-[var(--color-line-strong)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]',
  },
  tech: {
    active: 'badge-tech border-[var(--color-line-strong)] bg-[var(--color-surface-hover)] px-3 py-1.5 text-[var(--color-ink)]',
    inactive: 'badge-tech px-3 py-1.5 transition-colors duration-200 hover:text-[var(--color-ink)]',
  },
} as const;

export function FilterLink({ href, active, children, variant = 'solid' }: FilterLinkProps) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={STYLES[variant][active ? 'active' : 'inactive']}
    >
      {children}
    </Link>
  );
}
