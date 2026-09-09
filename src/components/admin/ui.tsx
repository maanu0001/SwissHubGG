import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icons } from '@/components/ui/Icon';

// `Field` ist eine Client-Komponente (Feldfehler über Kontext) und wird hier
// nur weitergereicht, damit die Importpfade einheitlich bleiben.
export { Field, FieldError } from '@/components/admin/FormField';

/** Wiederkehrende Bausteine des Admin-Dashboards. */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href: string }[];
}) {
  return (
    <header className="mb-8">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Brotkrumen" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-subtle)]">
            {breadcrumb.map((entry) => (
              <li key={entry.href} className="flex items-center gap-1.5">
                <Link href={entry.href} className="hover:text-[var(--color-ink-muted)]">
                  {entry.label}
                </Link>
                <span aria-hidden="true">/</span>
              </li>
            ))}
            <li className="text-[var(--color-ink-muted)]" aria-current="page">
              {title}
            </li>
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-ink-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {title || actions ? (
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-[var(--color-warning-text)]'
      : tone === 'danger'
        ? 'text-[var(--color-danger-text)]'
        : tone === 'success'
          ? 'text-[var(--color-success-text)]'
          : 'text-[var(--color-ink)]';

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card-interactive block p-5">
        {body}
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-text)]">
          Öffnen <Icons.arrowRight size={13} />
        </span>
      </Link>
    );
  }

  return <div className="card p-5">{body}</div>;
}

export function EmptyRow({ message, colSpan }: { message: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-[var(--color-ink-subtle)]">
        {message}
      </td>
    </tr>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border-b border-[var(--color-line-strong)] px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-subtle)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function InfoBox({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: 'border-[color-mix(in_srgb,var(--color-info)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-info)_12%,transparent)] text-[var(--color-info-text)]',
    warning:
      'border-[color-mix(in_srgb,var(--color-warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning-text)]',
    danger:
      'border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger-text)]',
    success:
      'border-[color-mix(in_srgb,var(--color-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success-text)]',
  } as const;

  const Icon = tone === 'warning' || tone === 'danger' ? Icons.alert : tone === 'success' ? Icons.check : Icons.info;

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border p-4 text-sm ${styles[tone]}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
