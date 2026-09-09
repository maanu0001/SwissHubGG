import type { Metadata } from 'next';

/**
 * Gemeinsames Layout des gesamten Admin-Bereichs.
 *
 * Bewusst ohne Sitzungsprüfung: Die Anmelde- und Hinweisseiten müssen ohne
 * Sitzung erreichbar sein. Die geschützte Oberfläche liegt in der Routen-Gruppe
 * `(dashboard)` und prüft dort die Berechtigung.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | SwissHub Admin' },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
