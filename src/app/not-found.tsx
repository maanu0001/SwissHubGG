import Link from 'next/link';
import type { Metadata } from 'next';
import { LogoStage } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { TechBackdrop } from '@/components/visual/TechBackdrop';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: true },
};

/** Individuelle 404-Seite mit sinnvollen Anschlusszielen. */
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <TechBackdrop variant="hero" />

      <div className="relative">
        <LogoStage size="compact" priority />
      </div>

      <p className="meta-brand relative mt-8">Fehler 404</p>
      <h1 className="heading-lg relative mt-3">Diese Seite gibt es nicht</h1>
      <p className="lead relative mx-auto mt-4 max-w-lg">
        Vielleicht wurde die Seite verschoben oder der Link ist nicht mehr aktuell. Von hier kommst du weiter:
      </p>

      <nav aria-label="Weiterführende Links" className="relative mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary btn-lg">
          Zur Startseite
        </Link>
        <Link href="/turniere" className="btn-secondary btn-lg">
          Turniere
        </Link>
        <Link href="/kontakt" className="btn-secondary btn-lg">
          Kontakt
          <Icons.arrowRight size={15} />
        </Link>
      </nav>
    </main>
  );
}
