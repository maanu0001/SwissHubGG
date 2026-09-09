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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid opacity-60" />
      <p className="meta-brand relative">Fehler</p>
      <h1 className="heading-lg relative mt-3">Da ist etwas schiefgelaufen</h1>
      <p className="lead relative mx-auto mt-4 max-w-lg">
        Die Seite konnte nicht vollständig geladen werden. Versuche es bitte erneut – falls das Problem bestehen
        bleibt, melde es uns über das Kontaktformular.
      </p>

      {error.digest ? (
        <p className="meta relative mt-5">
          Fehlerkennung: <span className="text-[var(--color-ink-muted)]">{error.digest}</span>
        </p>
      ) : null}

      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary btn-lg">
          Erneut versuchen
        </button>
        <Link href="/" className="btn-secondary btn-lg">
          Zur Startseite
        </Link>
        <Link href="/kontakt?kategorie=technik" className="btn-secondary btn-lg">
          Problem melden
        </Link>
      </div>
    </main>
  );
}
