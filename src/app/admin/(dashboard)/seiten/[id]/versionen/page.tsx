import { notFound } from 'next/navigation';
import { PageHeader, Panel, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { restoreVersionAction } from '@/server/actions/pages';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { SECTION_META } from '@/lib/content/sections';

/**
 * Versionshistorie einer Seite mit Vergleich zum jeweils vorherigen Stand.
 * Das Wiederherstellen legt den alten Stand als Entwurf an; veröffentlicht
 * wird bewusst in einem zweiten Schritt.
 */

export const metadata = { title: 'Versionen' };

type PageProps = { params: Promise<{ id: string }> };

type Snapshot = {
  title?: string;
  sections?: { id: string; type: keyof typeof SECTION_META; visible?: boolean; data?: unknown }[];
};

type Difference = { label: string; kind: 'hinzugefügt' | 'entfernt' | 'geändert' };

/** Vergleicht zwei Snapshots auf Abschnittsebene. */
function diffSnapshots(previous: Snapshot | null, current: Snapshot): Difference[] {
  if (!previous) return [{ label: 'Erste gespeicherte Version', kind: 'hinzugefügt' }];

  const before = new Map((previous.sections ?? []).map((section) => [section.id, section]));
  const after = new Map((current.sections ?? []).map((section) => [section.id, section]));
  const differences: Difference[] = [];

  if ((previous.title ?? '') !== (current.title ?? '')) {
    differences.push({ label: `Seitentitel: „${previous.title ?? ''}“ → „${current.title ?? ''}“`, kind: 'geändert' });
  }

  for (const [id, section] of after) {
    const old = before.get(id);
    const label = SECTION_META[section.type]?.label ?? section.type;

    if (!old) {
      differences.push({ label: `Abschnitt „${label}“`, kind: 'hinzugefügt' });
      continue;
    }
    if (JSON.stringify(old.data) !== JSON.stringify(section.data) || old.visible !== section.visible) {
      differences.push({ label: `Abschnitt „${label}“`, kind: 'geändert' });
    }
  }

  for (const [id, section] of before) {
    if (!after.has(id)) {
      const label = SECTION_META[section.type]?.label ?? section.type;
      differences.push({ label: `Abschnitt „${label}“`, kind: 'entfernt' });
    }
  }

  return differences;
}

export default async function PageVersionsPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.PAGES_VIEW);
  const canRestore = userHasPermission(user, PERMISSIONS.PAGES_EDIT);

  const page = await prisma.page.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!page) notFound();

  const versions = await prisma.pageVersion.findMany({
    where: { pageId: id },
    orderBy: { version: 'desc' },
    take: 50,
    include: { createdBy: { select: { displayName: true } } },
  });

  const badgeFor = (kind: Difference['kind']) =>
    kind === 'hinzugefügt' ? 'badge-success' : kind === 'entfernt' ? 'badge-danger' : 'badge-warning';

  return (
    <>
      <PageHeader
        title={`Versionen: ${page.title}`}
        description="Jede Veröffentlichung wird als Version archiviert. Frühere Stände lassen sich als Entwurf wiederherstellen."
        breadcrumb={[
          { label: 'Seiten', href: '/admin/seiten' },
          { label: page.title, href: `/admin/seiten/${page.id}` },
        ]}
      />

      {versions.length === 0 ? (
        <Panel>
          <InfoBox tone="info" title="Noch keine Versionen vorhanden">
            Sobald die Seite zum ersten Mal veröffentlicht wird, entsteht automatisch eine Version.
          </InfoBox>
        </Panel>
      ) : (
        <ol className="space-y-4">
          {versions.map((version, index) => {
            const current = version.content as Snapshot;
            const previousVersion = versions[index + 1];
            const previous = previousVersion ? (previousVersion.content as Snapshot) : null;
            const differences = diffSnapshots(previous, current);

            return (
              <li key={version.id}>
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--color-ink)]">
                        Version {version.version}
                        {index === 0 ? <span className="ml-2 badge-brand">aktuellste</span> : null}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                        {formatDateTime(version.createdAt)} · {version.createdBy?.displayName ?? 'System'} ·{' '}
                        {version.label ?? version.changeType}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                        {(current.sections ?? []).length} Abschnitt(e)
                      </p>
                    </div>

                    {canRestore ? (
                      <ActionForm action={restoreVersionAction}>
                        <input type="hidden" name="versionId" value={version.id} />
                        <SubmitButton
                          variant="secondary"
                          pendingLabel="Wird wiederhergestellt …"
                          confirm={`Version ${version.version} als Entwurf wiederherstellen? Der aktuelle Entwurf wird dabei ersetzt.`}
                        >
                          Wiederherstellen
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>

                  {differences.length > 0 ? (
                    <div className="mt-4 border-t border-[var(--color-line)] pt-4">
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                        Änderungen gegenüber der vorherigen Version
                      </h3>
                      <ul className="flex flex-wrap gap-2">
                        {differences.map((difference, position) => (
                          <li key={position} className={badgeFor(difference.kind)}>
                            {difference.kind}: {difference.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-ink-subtle)]">
                      Keine inhaltlichen Unterschiede zur vorherigen Version.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
