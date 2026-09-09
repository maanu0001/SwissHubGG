import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { PreviewFrame } from '@/components/admin/builder/PreviewFrame';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { parseSections } from '@/lib/content/sections';
import { formatDateTime } from '@/lib/format';

/**
 * Vorschau des aktuellen Entwurfs.
 *
 * Nur mit gültiger Sitzung und Leseberechtigung erreichbar. Vorschauseiten
 * werden nie indexiert und nicht zwischengespeichert.
 */

export const metadata: Metadata = {
  title: 'Vorschau',
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ ansicht?: string }> };

export default async function PreviewPage({ params, searchParams }: PageProps) {
  await requirePermission(PERMISSIONS.PAGES_VIEW);

  const { id } = await params;
  const { ansicht } = await searchParams;

  const page = await prisma.page.findUnique({
    where: { id },
    include: { sections: { orderBy: { position: 'asc' } } },
  });

  if (!page) {
    notFound();
  }

  const sections = parseSections(
    page.sections.map((section) => ({
      id: section.id,
      type: section.type,
      visible: section.visible,
      data: section.data,
    })),
  );

  const invalidCount = page.sections.length - sections.length;
  const viewport = ansicht === 'tablet' || ansicht === 'mobil' ? ansicht : 'desktop';

  return (
    <div className="min-h-dvh bg-[var(--color-canvas)]">
      <div className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning-text)]">
              Vorschau · nicht veröffentlichter Entwurf
            </p>
            <p className="truncate text-sm text-[var(--color-ink)]">
              {page.title} · zuletzt geändert {formatDateTime(page.updatedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Ansicht wählen" className="flex gap-1 rounded-lg border border-[var(--color-line)] p-1">
              {[
                { key: 'desktop', label: 'Desktop' },
                { key: 'tablet', label: 'Tablet' },
                { key: 'mobil', label: 'Mobil' },
              ].map((option) => (
                <Link
                  key={option.key}
                  href={`/vorschau/${page.id}?ansicht=${option.key}`}
                  aria-current={viewport === option.key ? 'true' : undefined}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    viewport === option.key
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </nav>

            <Link href={`/admin/seiten/${page.id}`} className="btn-secondary btn-sm">
              Zurück zum Builder
            </Link>
          </div>
        </div>

        {invalidCount > 0 ? (
          <p className="bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] px-4 py-2 text-center text-xs text-[var(--color-warning-text)]">
            {invalidCount} Abschnitt(e) enthalten unvollständige Angaben und werden auf der Website übersprungen.
          </p>
        ) : null}
      </div>

      <PreviewFrame viewport={viewport}>
        <div className="flex min-h-dvh flex-col bg-[var(--color-canvas)]">
          <SiteHeader />
          <main className="flex-1">
            {sections.length === 0 ? (
              <div className="mx-auto max-w-xl px-6 py-24 text-center">
                <h1 className="heading-md">Diese Seite hat noch keine Abschnitte</h1>
                <p className="lead mt-3">Füge im Builder den ersten Abschnitt hinzu.</p>
              </div>
            ) : (
              <SectionRenderer sections={sections} />
            )}
          </main>
          <SiteFooter />
        </div>
      </PreviewFrame>
    </div>
  );
}
