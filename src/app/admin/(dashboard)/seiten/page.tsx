import Link from 'next/link';
import { PageStatus } from '@prisma/client';
import { PageHeader, Panel, DataTable, EmptyRow, Field } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { createPageAction } from '@/server/actions/pages';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';

/** Übersicht aller Seiten mit Status, Terminen und Schnellzugriff. */

export const metadata = { title: 'Seiten' };

const STATUS_META: Record<PageStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Entwurf', badge: 'badge-warning' },
  PUBLISHED: { label: 'Veröffentlicht', badge: 'badge-success' },
  ARCHIVED: { label: 'Archiviert', badge: 'badge-neutral' },
};

export default async function AdminPagesPage() {
  const user = await requirePermission(PERMISSIONS.PAGES_VIEW);
  const canEdit = userHasPermission(user, PERMISSIONS.PAGES_EDIT);

  const pages = await prisma.page.findMany({
    orderBy: [{ isSystem: 'desc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      isSystem: true,
      publishedAt: true,
      updatedAt: true,
      scheduledPublishAt: true,
      archivedAt: true,
      _count: { select: { sections: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Seiten"
        description="Alle Inhaltsseiten der Website. Bearbeitung erfolgt im Website-Builder; veröffentlicht wird in einem separaten Schritt."
      />

      <div className="space-y-6">
        <Panel title="Alle Seiten">
          <DataTable headers={['Titel', 'URL', 'Status', 'Abschnitte', 'Zuletzt geändert', '']}>
            {pages.length === 0 ? (
              <EmptyRow message="Es sind noch keine Seiten angelegt." colSpan={6} />
            ) : (
              pages.map((page) => {
                const status = STATUS_META[page.status];

                return (
                  <tr key={page.id} className="hover:bg-[var(--color-surface-raised)]">
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <Link href={`/admin/seiten/${page.id}`} className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-text)]">
                        {page.title}
                      </Link>
                      {page.isSystem ? (
                        <span className="ml-2 badge-neutral text-[10px]">System</span>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 font-mono text-xs text-[var(--color-ink-muted)]">
                      /{page.slug === 'home' ? '' : page.slug}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <span className={status.badge}>{status.label}</span>
                      {page.scheduledPublishAt ? (
                        <span className="mt-1 block text-[11px] text-[var(--color-ink-subtle)]">
                          geplant: {formatDateTime(page.scheduledPublishAt)}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                      {page._count.sections}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {formatDateTime(page.updatedAt)}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/seiten/${page.id}`} className="btn-secondary btn-sm">
                          Bearbeiten
                        </Link>
                        {page.status === PageStatus.PUBLISHED ? (
                          <Link
                            href={page.slug === 'home' ? '/' : `/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost btn-sm"
                          >
                            Ansehen
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>
        </Panel>

        {canEdit ? (
          <Panel
            title="Neue Seite anlegen"
            description="Die Seite wird als Entwurf erstellt. Inhalte fügst du anschliessend im Builder hinzu."
          >
            <ActionForm action={createPageAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              {(state) => (
                <>
                  <Field label="Titel" name="title" required error={state.fieldErrors?.title}>
                    <input id="title" name="title" type="text" required maxLength={120} className="input" />
                  </Field>

                  <Field
                    label="URL"
                    name="slug"
                    hint="Leer lassen, um sie aus dem Titel abzuleiten."
                    error={state.fieldErrors?.slug}
                  >
                    <input
                      id="slug"
                      name="slug"
                      type="text"
                      maxLength={80}
                      placeholder="ueber-uns"
                      className="input font-mono text-sm"
                    />
                  </Field>

                  <SubmitButton pendingLabel="Wird angelegt …">Seite anlegen</SubmitButton>
                </>
              )}
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
