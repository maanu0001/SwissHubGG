import Link from 'next/link';
import { Icons, type IconName } from '@/components/ui/Icon';

/**
 * Hochwertig gestalteter Leerzustand.
 *
 * Statt Platzhaltern oder erfundenen Beispieldaten erklärt die Website
 * verständlich, warum hier nichts steht und was als Nächstes möglich ist.
 * Gestalterisch ist der Leerzustand ein vollwertiger Teil der Seite – keine
 * graue Restfläche.
 */
type EmptyStateProps = {
  title: string;
  description: string;
  action?: { href: string; label: string; external?: boolean };
  compact?: boolean;
  icon?: IconName;
};

export function EmptyState({ title, description, action, compact = false, icon = 'info' }: EmptyStateProps) {
  const Icon = Icons[icon] ?? Icons.info;

  return (
    <div
      className={`card relative flex flex-col items-center justify-center overflow-hidden text-center ${
        compact ? 'px-5 py-9' : 'px-6 py-14 sm:py-16'
      }`}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-dots opacity-40" />
      <span
        aria-hidden="true"
        className="glow-orb glow-brand pointer-events-none left-[calc(50%-9rem)] top-[calc(50%-9rem)] h-72 w-72 opacity-15"
      />

      <span className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] text-[var(--color-brand-text)]">
        <Icon size={20} />
      </span>

      <h3 className="relative text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="relative mt-2 max-w-md text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p>

      {action ? (
        action.external ? (
          <a href={action.href} target="_blank" rel="noopener noreferrer" className="btn-secondary relative mt-6">
            {action.label}
            <Icons.external size={13} />
          </a>
        ) : (
          <Link href={action.href} className="btn-secondary relative mt-6">
            {action.label}
            <Icons.arrowRight size={15} />
          </Link>
        )
      ) : null}
    </div>
  );
}
