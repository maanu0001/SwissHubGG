'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Auffangseite für unerwartete Fehler.
 * Es werden bewusst keine technischen Details angezeigt; die Fehlerkennung
 * hilft beim Abgleich mit dem Serverlog.
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unerwarteter Fehler auf der Website:', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-text)]">Fehler</p>
      <h1 className="heading-lg mt-3">Da ist etwas schiefgelaufen</h1>
      <p className="lead mt-4 max-w-lg">
        Die Seite konnte nicht vollständig geladen werden. Versuche es bitte erneut – falls das Problem bestehen
        bleibt, melde es uns über das Kontaktformular.
      </p>

      {error.digest ? (
        <p className="mt-4 text-xs text-[var(--color-ink-subtle)]">
          Fehlerkennung: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Erneut versuchen
        </button>
        <Link href="/" className="btn-secondary">
          Zur Startseite
        </Link>
        <Link href="/kontakt?kategorie=technik" className="btn-secondary">
          Problem melden
        </Link>
      </div>
    </main>
  );
}
