import Link from 'next/link';
import { PageHeader, Panel, DataTable, EmptyRow, Field } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { createSponsorAction, saveSponsorTierAction } from '@/server/actions/sponsors';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateRange } from '@/lib/format';

export const metadata = { title: 'Sponsoren' };

/** Übersicht der Sponsoren und Pflege der Sponsoring-Stufen. */
export default async function AdminSponsorsPage() {
  const user = await requirePermission(PERMISSIONS.SPONSORS_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.SPONSORS_MANAGE);

  const [sponsors, tiers] = await Promise.all([
    prisma.sponsor.findMany({
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        publishedAt: true,
        archivedAt: true,
        featured: true,
        partnerSince: true,
        partnerUntil: true,
        tier: { select: { name: true } },
        _count: { select: { tournaments: true } },
      },
    }),
    prisma.sponsorTier.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader
        title="Sponsoren & Partner"
        description="Partnerschaften pflegen, Stufen vergeben und die öffentliche Darstellung steuern."
      />

      <div className="space-y-6">
        <Panel title={`Alle Partner (${sponsors.length})`}>
          <DataTable headers={['Name', 'Stufe', 'Status', 'Sichtbar', 'Zeitraum', 'Turniere', '']}>
            {sponsors.length === 0 ? (
              <EmptyRow message="Es sind noch keine Partner erfasst." colSpan={7} />
            ) : (
              sponsors.map((sponsor) => (
                <tr key={sponsor.id} className="hover:bg-[var(--color-surface-raised)]">
                  <td className="border-b border-[var(--color-line)] px-4 py-3">
                    <Link
                      href={`/admin/sponsoren/${sponsor.id}`}
                      className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-text)]"
                    >
                      {sponsor.name}
                    </Link>
                    {sponsor.featured ? <span className="ml-2 badge-brand text-[10px]">Highlight</span> : null}
                    {sponsor.archivedAt ? <span className="ml-2 badge-neutral text-[10px]">Archiv</span> : null}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                    {sponsor.tier?.name ?? '–'}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3">
                    <span className={sponsor.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}>
                      {sponsor.status === 'ACTIVE' ? 'aktiv' : 'ehemalig'}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3">
                    {sponsor.publishedAt ? (
                      <span className="badge-success">öffentlich</span>
                    ) : (
                      <span className="badge-neutral">intern</span>
                    )}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                    {formatDateRange(sponsor.partnerSince, sponsor.partnerUntil)}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                    {sponsor._count.tournaments}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-3 text-right">
                    <Link href={`/admin/sponsoren/${sponsor.id}`} className="btn-secondary btn-sm">
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>

        {canManage ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Neuen Partner anlegen">
              <ActionForm action={createSponsorAction} className="space-y-4">
                {(state) => (
                  <>
                    <Field label="Name" name="name" required error={state.fieldErrors?.name}>
                      <input id="name" name="name" type="text" required maxLength={120} className="input" />
                    </Field>
                    <SubmitButton pendingLabel="Wird angelegt …">Partner anlegen</SubmitButton>
                  </>
                )}
              </ActionForm>
            </Panel>

            <Panel title="Sponsoring-Stufen" description="Zum Beispiel Hauptsponsor, Hosting-Partner oder Medienpartner.">
              <ul className="mb-5 space-y-2">
                {tiers.length === 0 ? (
                  <li className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Stufen erfasst.</li>
                ) : (
                  tiers.map((tier) => (
                    <li key={tier.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2">
                      <p className="text-sm text-[var(--color-ink)]">{tier.name}</p>
                      <p className="text-xs text-[var(--color-ink-subtle)]">
                        Schlüssel: {tier.key} · Reihenfolge: {tier.sortOrder}
                      </p>
                    </li>
                  ))
                )}
              </ul>

              <ActionForm action={saveSponsorTierAction} resetOnSuccess className="space-y-4 border-t border-[var(--color-line)] pt-5">
                {(state) => (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name" name="name" required error={state.fieldErrors?.name}>
                        <input id="name" name="name" type="text" required maxLength={60} className="input" />
                      </Field>
                      <Field label="Reihenfolge" name="sortOrder">
                        <input id="sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
                      </Field>
                    </div>
                    <SubmitButton variant="secondary">Stufe hinzufügen</SubmitButton>
                  </>
                )}
              </ActionForm>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
