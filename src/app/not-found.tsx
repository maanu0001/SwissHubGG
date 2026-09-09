import Link from 'next/link';
import type { Metadata } from 'next';
import { LogoMark } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: true },
};

/** Individuelle 404-Seite mit sinnvollen Anschlusszielen. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <LogoMark size={64} priority />
      <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-text)]">
        Fehler 404
      </p>
      <h1 className="heading-lg mt-3">Diese Seite gibt es nicht</h1>
      <p className="lead mt-4 max-w-lg">
        Vielleicht wurde die Seite verschoben oder der Link ist nicht mehr aktuell. Von hier kommst du weiter:
      </p>

      <nav aria-label="Weiterführende Links" className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Zur Startseite
        </Link>
        <Link href="/turniere" className="btn-secondary">
          Turniere
        </Link>
        <Link href="/kontakt" className="btn-secondary">
          Kontakt
          <Icons.arrowRight size={15} />
        </Link>
      </nav>
    </main>
  );
}
