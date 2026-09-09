import { MediaKind } from '@prisma/client';
import { PageHeader, Panel, Field } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { MediaSelectField } from '@/components/admin/MediaSelectField';
import { deleteTeamMemberAction, saveTeamMemberAction } from '@/server/actions/settings';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Team' };

/** Pflege des Vereins- bzw. Teambereichs für die Seite „Über uns“. */
export default async function AdminTeamPage() {
  await requirePermission(PERMISSIONS.PAGES_EDIT);

  const [members, media] = await Promise.all([
    prisma.teamMember.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.mediaAsset.findMany({
      where: { kind: MediaKind.IMAGE },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, originalName: true, title: true, storageKey: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Team & Verein"
        description="Diese Einträge erscheinen im Block „Teammitglieder“, sobald sie veröffentlicht sind."
      />

      <div className="space-y-6">
        <Panel title={`Einträge (${members.length})`}>
          <ul className="space-y-3">
            {members.length === 0 ? (
              <li className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Einträge vorhanden.</li>
            ) : (
              members.map((member) => (
                <li key={member.id} className="rounded-lg border border-[var(--color-line)] p-4">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        {member.name} · <span className="text-[var(--color-ink-muted)]">{member.role}</span>
                      </span>
                      <span className={member.publishedAt && member.active ? 'badge-success' : 'badge-neutral'}>
                        {member.publishedAt && member.active ? 'sichtbar' : 'intern'}
                      </span>
                    </summary>

                    <ActionForm action={saveTeamMemberAction} className="mt-4 space-y-3">
                      {(state) => (
                        <>
                          <input type="hidden" name="id" value={member.id} />

                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label="Name" name={`name-${member.id}`} required error={state.fieldErrors?.name}>
                              <input id={`name-${member.id}`} name="name" type="text" required maxLength={80} defaultValue={member.name} className="input" />
                            </Field>
                            <Field label="Funktion" name={`role-${member.id}`} required error={state.fieldErrors?.role}>
                              <input id={`role-${member.id}`} name="role" type="text" required maxLength={80} defaultValue={member.role} className="input" />
                            </Field>
                            <Field label="Reihenfolge" name={`sortOrder-${member.id}`}>
                              <input id={`sortOrder-${member.id}`} name="sortOrder" type="number" defaultValue={member.sortOrder} className="input" />
                            </Field>
                          </div>

                          <Field label="Beschreibung" name={`description-${member.id}`}>
                            <textarea id={`description-${member.id}`} name="description" rows={2} maxLength={300} defaultValue={member.description ?? ''} className="input resize-y" />
                          </Field>

                          <MediaSelectField label="Bild" name="avatarId" media={media} defaultValue={member.avatarId} />

                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                              <input type="checkbox" name="active" defaultChecked={member.active} className="h-4 w-4 accent-[var(--color-brand)]" />
                              Aktiv
                            </label>
                            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                              <input type="checkbox" name="published" defaultChecked={member.publishedAt !== null} className="h-4 w-4 accent-[var(--color-brand)]" />
                              Auf der Website anzeigen
                            </label>
                          </div>

                          <SubmitButton variant="secondary">Speichern</SubmitButton>
                        </>
                      )}
                    </ActionForm>

                    <ActionForm action={deleteTeamMemberAction} className="mt-3">
                      <input type="hidden" name="id" value={member.id} />
                      <SubmitButton variant="danger" pendingLabel="…" confirm={`Eintrag „${member.name}“ entfernen?`}>
                        Entfernen
                      </SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              ))
            )}
          </ul>
        </Panel>

        <Panel title="Eintrag hinzufügen">
          <ActionForm action={saveTeamMemberAction} resetOnSuccess className="space-y-4">
            {(state) => (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Name" name="name" required error={state.fieldErrors?.name}>
                    <input id="name" name="name" type="text" required maxLength={80} className="input" />
                  </Field>
                  <Field label="Funktion" name="role" required error={state.fieldErrors?.role}>
                    <input id="role" name="role" type="text" required maxLength={80} className="input" placeholder="Vorstand, Turnierleitung …" />
                  </Field>
                  <Field label="Reihenfolge" name="sortOrder">
                    <input id="sortOrder" name="sortOrder" type="number" defaultValue={members.length} className="input" />
                  </Field>
                </div>

                <Field label="Beschreibung" name="description">
                  <textarea id="description" name="description" rows={2} maxLength={300} className="input resize-y" />
                </Field>

                <MediaSelectField label="Bild" name="avatarId" media={media} />

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                    Aktiv
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <input type="checkbox" name="published" className="h-4 w-4 accent-[var(--color-brand)]" />
                    Auf der Website anzeigen
                  </label>
                </div>

                <SubmitButton>Eintrag hinzufügen</SubmitButton>
              </>
            )}
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
