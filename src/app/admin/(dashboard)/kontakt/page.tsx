import Link from 'next/link';
import { ContactPriority, ContactStatus, type Prisma } from '@prisma/client';
import { PageHeader, Panel, DataTable, EmptyRow } from '@/components/admin/ui';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { Icons } from '@/components/ui/Icon';

export const metadata = { title: 'Kontaktanfragen' };

/** Team-Inbox mit Suche, Filtern und Blätterfunktion. */

export const CONTACT_STATUS_META: Record<ContactStatus, { label: string; badge: string }> = {
  NEW: { label: 'Neu', badge: 'badge-warning' },
  IN_PROGRESS: { label: 'In Bearbeitung', badge: 'badge-info' },
  ANSWERED: { label: 'Beantwortet', badge: 'badge-success' },
  CLOSED: { label: 'Geschlossen', badge: 'badge-neutral' },
  SPAM: { label: 'Spam', badge: 'badge-danger' },
};

export const CONTACT_PRIORITY_LABEL: Record<ContactPriority, string> = {
  LOW: 'Niedrig',
  NORMAL: 'Normal',
  HIGH: 'Hoch',
  URGENT: 'Dringend',
};

const PAGE_SIZE = 25;

type PageProps = {
  searchParams: Promise<{ status?: string; kategorie?: string; suche?: string; seite?: string }>;
};

export default async function AdminContactPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await requirePermission(PERMISSIONS.CONTACT_READ);
  const canExport = userHasPermission(user, PERMISSIONS.CONTACT_EXPORT);

  const statusFilter = Object.values(ContactStatus).includes(params.status as ContactStatus)
    ? (params.status as ContactStatus)
    : null;
  const search = (params.suche ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.seite ?? '1', 10) || 1);

  const where: Prisma.ContactRequestWhereInput = {
    archivedAt: null,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(params.kategorie ? { category: { key: params.kategorie } } : {}),
    ...(search
      ? {
          OR: [
            { reference: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [requests, total, categories, counts] = await Promise.all([
    prisma.contactRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        name: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
        anonymizedAt: true,
        category: { select: { label: true } },
        assignedTo: { select: { displayName: true } },
        _count: { select: { attachments: true, messages: true } },
      },
    }),
    prisma.contactRequest.count({ where }),
    prisma.contactCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { key: true, label: true } }),
    prisma.contactRequest.groupBy({ by: ['status'], where: { archivedAt: null }, _count: true }),
  ]);

  const countFor = (status: ContactStatus) => counts.find((entry) => entry.status === status)?._count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = { status: params.status, kategorie: params.kategorie, suche: params.suche, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const suffix = query.toString();
    return suffix ? `/admin/kontakt?${suffix}` : '/admin/kontakt';
  };

  return (
    <>
      <PageHeader
        title="Kontaktanfragen"
        description="Alle über das Kontaktformular eingegangenen Anfragen."
        actions={
          canExport ? (
            <Link href="/api/admin/kontakt/export" className="btn-secondary" prefetch={false}>
              Als CSV exportieren
            </Link>
          ) : null
        }
      />

      <div className="space-y-6">
        <Panel>
          <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div>
              <label htmlFor="suche" className="field-label">
                Suche
              </label>
              <input
                id="suche"
                name="suche"
                type="search"
                defaultValue={search}
                placeholder="Referenz, Betreff, Name, E-Mail oder Text"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="status" className="field-label">
                Status
              </label>
              <select id="status" name="status" defaultValue={params.status ?? ''} className="select">
                <option value="">Alle</option>
                {Object.values(ContactStatus).map((status) => (
                  <option key={status} value={status}>
                    {CONTACT_STATUS_META[status].label} ({countFor(status)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="kategorie" className="field-label">
                Kategorie
              </label>
              <select id="kategorie" name="kategorie" defaultValue={params.kategorie ?? ''} className="select">
                <option value="">Alle</option>
                {categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary">
              Filtern
            </button>
          </form>
        </Panel>

        <Panel title={`${total} Anfrage(n)`}>
          <DataTable headers={['Referenz', 'Betreff', 'Kategorie', 'Status', 'Zuständig', 'Eingegangen', '']}>
            {requests.length === 0 ? (
              <EmptyRow
                message={
                  search || statusFilter
                    ? 'Für diese Auswahl liegen keine Anfragen vor.'
                    : 'Es sind noch keine Anfragen eingegangen.'
                }
                colSpan={7}
              />
            ) : (
              requests.map((request) => {
                const status = CONTACT_STATUS_META[request.status];

                return (
                  <tr key={request.id} className="hover:bg-[var(--color-surface-raised)]">
                    <td className="border-b border-[var(--color-line)] px-4 py-3 font-mono text-xs text-[var(--color-ink-muted)]">
                      {request.reference}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <Link
                        href={`/admin/kontakt/${request.id}`}
                        className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-text)]"
                      >
                        {request.subject}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-ink-subtle)]">
                        {request.name}
                        {request._count.attachments > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Icons.info size={11} />
                            {request._count.attachments} Anhang
                          </span>
                        ) : null}
                        {request.anonymizedAt ? <span className="badge-neutral text-[10px]">anonymisiert</span> : null}
                      </p>
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                      {request.category?.label ?? '–'}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <span className={status.badge}>{status.label}</span>
                      {request.priority !== ContactPriority.NORMAL ? (
                        <span className="mt-1 block text-[11px] text-[var(--color-ink-subtle)]">
                          {CONTACT_PRIORITY_LABEL[request.priority]}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {request.assignedTo?.displayName ?? '–'}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {formatDateTime(request.createdAt)}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-right">
                      <Link href={`/admin/kontakt/${request.id}`} className="btn-secondary btn-sm">
                        Öffnen
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>

          {totalPages > 1 ? (
            <nav aria-label="Seiten" className="mt-5 flex items-center justify-between text-sm">
              <span className="text-[var(--color-ink-subtle)]">
                Seite {page} von {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={buildHref({ seite: String(page - 1) })} className="btn-secondary btn-sm">
                    Zurück
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={buildHref({ seite: String(page + 1) })} className="btn-secondary btn-sm">
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
