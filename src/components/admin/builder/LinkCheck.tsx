'use client';

import { useState, useTransition } from 'react';
import { Icons } from '@/components/ui/Icon';
import { checkPageLinksAction, type LinkCheckResult } from '@/server/actions/links';

/**
 * Linkprüfung für eine Seite.
 * Wird bewusst nur auf Knopfdruck ausgeführt, damit keine Hintergrundlast
 * gegenüber externen Diensten entsteht.
 */
export function LinkCheck({ pageId }: { pageId: string }) {
  const [results, setResults] = useState<LinkCheckResult[] | null>(null);
  const [pending, startTransition] = useTransition();

  const badge = (status: LinkCheckResult['status']) =>
    status === 'ok'
      ? 'badge-success'
      : status === 'fehlt' || status === 'fehler'
        ? 'badge-danger'
        : 'badge-warning';

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Linkprüfung</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Prüft alle Links dieser Seite: interne Ziele gegen die vorhandenen Inhalte, externe mit einer einmaligen
            Anfrage.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await checkPageLinksAction(pageId);
              setResults(result);
            })
          }
        >
          {pending ? 'Wird geprüft …' : 'Links prüfen'}
        </button>
      </div>

      <div aria-live="polite">
        {results === null ? (
          <p className="text-sm text-[var(--color-ink-subtle)]">Noch keine Prüfung durchgeführt.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Diese Seite enthält keine Links.</p>
        ) : (
          <ul className="space-y-2">
            {results.map((result) => (
              <li
                key={result.href || result.label}
                className="flex flex-wrap items-start gap-2 rounded-lg border border-[var(--color-line)] p-3 text-sm"
              >
                <span className={badge(result.status)}>{result.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--color-ink)]">{result.label || 'Ohne Beschriftung'}</p>
                  <p className="truncate font-mono text-xs text-[var(--color-ink-subtle)]">{result.href}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{result.detail}</p>
                </div>
                {result.scope === 'extern' ? (
                  <Icons.external size={13} className="mt-1 text-[var(--color-ink-subtle)]" />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
