import { notFound } from 'next/navigation';
import { MediaKind } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { MediaSelectField } from '@/components/admin/MediaSelectField';
import { archiveSponsorAction, publishSponsorAction, updateSponsorAction } from '@/server/actions/sponsors';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { toLocalInputValue } from '@/server/actions/types';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const sponsor = await prisma.sponsor.findUnique({ where: { id }, select: { name: true } });
  return { title: sponsor ? sponsor.name : 'Partner' };
}

/** Bearbeitung eines einzelnen Sponsors bzw. Partners. */
export default async function AdminSponsorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.SPONSORS_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.SPONSORS_MANAGE);

  const sponsor = await prisma.sponsor.findUnique({
    where: { id },
    include: { tournaments: { include: { tournament: { select: { title: true, slug: true } } } } },
  });

  if (!sponsor) notFound();

  const [tiers, media] = await Promise.all([
    prisma.sponsorTier.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.mediaAsset.findMany({
      where: { kind: MediaKind.IMAGE },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, originalName: true, title: true, storageKey: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={sponsor.name}
        description="Angaben, Logo und Sichtbarkeit dieses Partners."
        breadcrumb={[{ label: 'Sponsoren', href: '/admin/sponsoren' }]}
      />

      <div className="mb-6 space-y-4">
        <InfoBox tone={sponsor.publishedAt ? 'success' : 'info'}>
          {sponsor.publishedAt
            ? `Öffentlich sichtbar seit ${formatDateTime(sponsor.publishedAt)}.`
            : 'Dieser Partner ist noch nicht öffentlich sichtbar.'}
        </InfoBox>

        {canManage ? (
          <div className="flex flex-wrap gap-3">
            <ActionForm action={publishSponsorAction}>
              <input type="hidden" name="id" value={sponsor.id} />
              <SubmitButton pendingLabel="Wird ausgeführt …">
                {sponsor.publishedAt ? 'Zurückziehen' : 'Veröffentlichen'}
              </SubmitButton>
            </ActionForm>

            <ActionForm action={archiveSponsorAction}>
              <input type="hidden" name="id" value={sponsor.id} />
              <SubmitButton
                variant="danger"
                pendingLabel="Wird ausgeführt …"
                confirm={sponsor.archivedAt ? 'Partner wiederherstellen?' : 'Partner archivieren?'}
              >
                {sponsor.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
              </SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <Panel title="Partnerdaten">
          <ActionForm action={updateSponsorAction} className="space-y-5">
            <>
              <input type="hidden" name="id" value={sponsor.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" name="name" required>
                  <input id="name" name="name" type="text" required maxLength={120} defaultValue={sponsor.name} disabled={!canManage} className="input" />
                </Field>
                <Field label="URL-Kürzel" name="slug" hint="Wird intern für Verlinkungen verwendet.">
                  <input id="slug" name="slug" type="text" maxLength={80} defaultValue={sponsor.slug} disabled={!canManage} className="input font-mono text-sm" />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Status" name="status">
                  <select id="status" name="status" defaultValue={sponsor.status} disabled={!canManage} className="select">
                    <option value="ACTIVE">Aktiver Partner</option>
                    <option value="FORMER">Ehemaliger Partner</option>
                  </select>
                </Field>
                <Field label="Stufe" name="tierId">
                  <select id="tierId" name="tierId" defaultValue={sponsor.tierId ?? ''} disabled={!canManage} className="select">
                    <option value="">Keine Stufe</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reihenfolge" name="sortOrder">
                  <input id="sortOrder" name="sortOrder" type="number" defaultValue={sponsor.sortOrder} disabled={!canManage} className="input" />
                </Field>
              </div>

              <Field label="Website" name="websiteUrl">
                <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={sponsor.websiteUrl ?? ''} disabled={!canManage} className="input" />
              </Field>

              <Field label="Kurzbeschreibung" name="shortDescription" hint="Erscheint auf der Partnerkarte.">
                <textarea id="shortDescription" name="shortDescription" rows={2} maxLength={300} defaultValue={sponsor.shortDescription ?? ''} disabled={!canManage} className="input resize-y" />
              </Field>

              <Field label="Ausführliche Beschreibung" name="description" hint="Markdown erlaubt.">
                <textarea id="description" name="description" rows={6} defaultValue={sponsor.description ?? ''} disabled={!canManage} className="input resize-y font-mono text-[13px]" />
              </Field>

              <MediaSelectField
                label="Logo"
                name="logoId"
                media={media}
                defaultValue={sponsor.logoId}
                disabled={!canManage}
                hint="Wird proportional eingepasst und nie verzerrt."
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Partner seit" name="partnerSince">
                  <input id="partnerSince" name="partnerSince" type="datetime-local" defaultValue={toLocalInputValue(sponsor.partnerSince)} disabled={!canManage} className="input" />
                </Field>
                <Field label="Partner bis" name="partnerUntil">
                  <input id="partnerUntil" name="partnerUntil" type="datetime-local" defaultValue={toLocalInputValue(sponsor.partnerUntil)} disabled={!canManage} className="input" />
                </Field>
                <Field label="Geplante Veröffentlichung" name="scheduledPublishAt">
                  <input id="scheduledPublishAt" name="scheduledPublishAt" type="datetime-local" defaultValue={toLocalInputValue(sponsor.scheduledPublishAt)} disabled={!canManage} className="input" />
                </Field>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <input type="checkbox" name="featured" defaultChecked={sponsor.featured} disabled={!canManage} className="h-4 w-4 accent-[var(--color-brand)]" />
                Hervorheben
              </label>

              {canManage ? <SubmitButton>Partner speichern</SubmitButton> : null}
            </>
          </ActionForm>
        </Panel>

        <Panel title="Unterstützte Turniere" description="Die Zuordnung erfolgt in der jeweiligen Turnierverwaltung.">
          {sponsor.tournaments.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-subtle)]">Dieser Partner ist keinem Turnier zugeordnet.</p>
          ) : (
            <ul className="space-y-2">
              {sponsor.tournaments.map((entry) => (
                <li key={entry.tournamentId} className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm text-[var(--color-ink)]">
                  {entry.tournament.title}
                  {entry.role ? <span className="ml-2 text-xs text-[var(--color-ink-subtle)]">({entry.role})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
