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
    <header className="mb-8 border-b border-[var(--color-line)] pb-6">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Brotkrumen" className="mb-3">
          <ol className="meta flex flex-wrap items-center gap-1.5">
            {breadcrumb.map((entry) => (
              <li key={entry.href} className="flex items-center gap-1.5">
                <Link href={entry.href} className="transition-colors hover:text-[var(--color-ink-muted)]">
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
          <h1 className="heading-md text-[var(--color-ink)]">{title}</h1>
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
        <div className="mb-5 flex flex-col gap-2 border-b border-[var(--color-line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
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
      <p className="meta">{label}</p>
      <p className={`numeric mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card-interactive group relative block overflow-hidden p-5">
        <span aria-hidden="true" className="accent-line absolute inset-x-0 top-0 h-px bg-[var(--color-brand)]" />
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
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-void)] text-[var(--color-ink-subtle)]">
          <Icons.info size={18} />
        </span>
        <span className="block text-sm text-[var(--color-ink-muted)]">{message}</span>
      </td>
    </tr>
  );
}

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-line)]">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="bg-[var(--color-void)]">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="meta border-b border-[var(--color-line)] px-4 py-3 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:transition-colors [&>tr:hover]:bg-[var(--color-surface-raised)]">{children}</tbody>
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
