import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { PageHeader, Panel, DataTable, EmptyRow, InfoBox } from '@/components/admin/ui';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Audit-Log' };

const PAGE_SIZE = 50;

type PageProps = { searchParams: Promise<{ aktion?: string; typ?: string; seite?: string }> };

/** Protokoll aller administrativen Vorgänge. Nur lesbar, nicht veränderbar. */
export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requirePermission(PERMISSIONS.AUDIT_VIEW);

  const page = Math.max(1, Number.parseInt(params.seite ?? '1', 10) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(params.aktion ? { action: params.aktion } : {}),
    ...(params.typ ? { entityType: params.typ } : {}),
  };

  const [entries, total, actions, types] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { action: 'asc' } }),
    prisma.auditLog.groupBy({ by: ['entityType'], _count: true, orderBy: { entityType: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    if (params.aktion) query.set('aktion', params.aktion);
    if (params.typ) query.set('typ', params.typ);
    query.set('seite', String(nextPage));
    return `/admin/audit?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Audit-Log"
        description="Nachvollziehbare Aufzeichnung aller administrativen Änderungen. Einträge können nicht bearbeitet oder gelöscht werden."
      />

      <div className="space-y-6">
        <InfoBox tone="info">
          Protokolliert werden unter anderem An- und Abmeldungen, abgelehnte Zugriffe, Änderungen an Inhalten,
          Rollen- und Rechteänderungen, Einstellungen, E-Mail-Empfänger, Statusänderungen bei Kontaktanfragen sowie
          Lösch- und Anonymisierungsvorgänge. IP-Adressen werden nur pseudonymisiert gespeichert.
        </InfoBox>

        <Panel>
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="aktion" className="field-label">
                Aktion
              </label>
              <select id="aktion" name="aktion" defaultValue={params.aktion ?? ''} className="select">
                <option value="">Alle</option>
                {actions.map((entry) => (
                  <option key={entry.action} value={entry.action}>
                    {entry.action} ({entry._count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="typ" className="field-label">
                Objekttyp
              </label>
              <select id="typ" name="typ" defaultValue={params.typ ?? ''} className="select">
                <option value="">Alle</option>
                {types.map((entry) => (
                  <option key={entry.entityType} value={entry.entityType}>
                    {entry.entityType} ({entry._count})
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Filtern
            </button>
          </form>
        </Panel>

        <Panel title={`${total} Eintrag/Einträge`}>
          <DataTable headers={['Zeitpunkt', 'Person', 'Aktion', 'Objekt', 'Beschreibung']}>
            {entries.length === 0 ? (
              <EmptyRow message="Für diese Auswahl liegen keine Einträge vor." colSpan={5} />
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-xs whitespace-nowrap text-[var(--color-ink-muted)]">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink)]">
                    {entry.actorLabel}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-xs text-[var(--color-ink-muted)]">
                    {entry.action}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-xs text-[var(--color-ink-muted)]">
                    {entry.entityType}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-muted)]">
                    {entry.summary}
                  </td>
                </tr>
              ))
            )}
          </DataTable>

          {totalPages > 1 ? (
            <nav aria-label="Seiten" className="mt-5 flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-subtle)]">
                Seite {page} von {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={buildHref(page - 1)} className="btn-secondary btn-sm">
                    Zurück
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={buildHref(page + 1)} className="btn-secondary btn-sm">
                    Weiter
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
