import Link from 'next/link';
import { Icons } from '@/components/ui/Icon';

/**
 * Hochwertig gestalteter Leerzustand.
 *
 * Statt Platzhaltern oder erfundenen Beispieldaten erklärt die Website
 * verständlich, warum hier nichts steht und was als Nächstes möglich ist.
 */
type EmptyStateProps = {
  title: string;
  description: string;
  action?: { href: string; label: string; external?: boolean };
  compact?: boolean;
};

export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`card flex flex-col items-center justify-center text-center ${compact ? 'px-5 py-8' : 'px-6 py-14'}`}
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink-subtle)]">
        <Icons.info size={20} />
      </span>
      <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--color-ink-muted)]">{description}</p>

      {action ? (
        action.external ? (
          <a href={action.href} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-5">
            {action.label}
            <Icons.external size={13} />
          </a>
        ) : (
          <Link href={action.href} className="btn-secondary mt-5">
            {action.label}
            <Icons.arrowRight size={15} />
          </Link>
        )
      ) : null}
    </div>
  );
}
