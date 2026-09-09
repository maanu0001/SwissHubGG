import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { deleteNavigationItemAction, saveNavigationItemAction } from '@/server/actions/settings';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Navigation' };

/** Pflege der Menüs in Kopf- und Fussbereich. */
export default async function AdminNavigationPage() {
  await requirePermission(PERMISSIONS.NAVIGATION_MANAGE);

  const [menus, pages] = await Promise.all([
    prisma.navigation.findMany({
      orderBy: { key: 'asc' },
      include: { items: { orderBy: { position: 'asc' } } },
    }),
    prisma.page.findMany({
      where: { status: 'PUBLISHED', archivedAt: null },
      orderBy: { title: 'asc' },
      select: { slug: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Navigation"
        description="Menüpunkte im Kopf- und Fussbereich der Website. Die Reihenfolge steuert das Feld „Position“."
      />

      <div className="space-y-6">
        <InfoBox tone="info" title="Gültige Ziele">
          Interne Seiten werden als Pfad angegeben (z. B. <code>/turniere</code>). Aktuell veröffentlichte Seiten:{' '}
          {pages.length > 0 ? pages.map((page) => `/${page.slug === 'home' ? '' : page.slug}`).join(', ') : 'keine'}.
          Externe Ziele beginnen mit <code>https://</code>.
        </InfoBox>

        {menus.map((menu) => (
          <Panel key={menu.id} title={menu.name} description={`Schlüssel: ${menu.key}`}>
            <ul className="mb-6 space-y-3">
              {menu.items.length === 0 ? (
                <li className="text-sm text-[var(--color-ink-subtle)]">Dieses Menü ist noch leer.</li>
              ) : (
                menu.items.map((item) => (
                  <li key={item.id} className="rounded-lg border border-[var(--color-line)] p-4">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--color-ink)]">
                          {item.position}. {item.label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[var(--color-ink-subtle)]">{item.href}</span>
                          <span className={item.visible ? 'badge-success' : 'badge-neutral'}>
                            {item.visible ? 'sichtbar' : 'versteckt'}
                          </span>
                        </span>
                      </summary>

                      <ActionForm action={saveNavigationItemAction} className="mt-4 space-y-3">
                        <>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="navigationKey" value={menu.key} />

                          <div className="grid gap-3 sm:grid-cols-3">
                            <Field label="Beschriftung" name={`label-${item.id}`} errorKey="label" required>
                              <input id={`label-${item.id}`} name="label" type="text" required maxLength={60} defaultValue={item.label} className="input" />
                            </Field>
                            <Field label="Ziel" name={`href-${item.id}`} errorKey="href" required>
                              <input id={`href-${item.id}`} name="href" type="text" required maxLength={300} defaultValue={item.href} className="input font-mono text-sm" />
                            </Field>
                            <Field label="Position" name={`position-${item.id}`} errorKey="position">
                              <input id={`position-${item.id}`} name="position" type="number" defaultValue={item.position} className="input" />
                            </Field>
                          </div>

                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                              <input type="checkbox" name="visible" defaultChecked={item.visible} className="h-4 w-4 accent-[var(--color-brand)]" />
                              Sichtbar
                            </label>
                            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                              <input type="checkbox" name="openInNewTab" defaultChecked={item.openInNewTab} className="h-4 w-4 accent-[var(--color-brand)]" />
                              In neuem Tab öffnen
                            </label>
                            <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                              <input type="checkbox" name="highlight" defaultChecked={item.highlight} className="h-4 w-4 accent-[var(--color-brand)]" />
                              Hervorheben
                            </label>
                          </div>

                          <SubmitButton variant="secondary">Speichern</SubmitButton>
                        </>
                      </ActionForm>

                      <ActionForm action={deleteNavigationItemAction} className="mt-3">
                        <input type="hidden" name="id" value={item.id} />
                        <SubmitButton variant="danger" pendingLabel="…" confirm={`Menüpunkt „${item.label}“ entfernen?`}>
                          Entfernen
                        </SubmitButton>
                      </ActionForm>
                    </details>
                  </li>
                ))
              )}
            </ul>

            <ActionForm action={saveNavigationItemAction} resetOnSuccess className="space-y-3 border-t border-[var(--color-line)] pt-6">
              <>
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">Menüpunkt hinzufügen</h3>
                <input type="hidden" name="navigationKey" value={menu.key} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Beschriftung" name={`new-label-${menu.key}`} required>
                    <input id={`new-label-${menu.key}`} name="label" type="text" required maxLength={60} className="input" />
                  </Field>
                  <Field label="Ziel" name={`new-href-${menu.key}`} required>
                    <input id={`new-href-${menu.key}`} name="href" type="text" required maxLength={300} className="input font-mono text-sm" placeholder="/turniere" />
                  </Field>
                  <Field label="Position" name={`new-position-${menu.key}`}>
                    <input id={`new-position-${menu.key}`} name="position" type="number" defaultValue={menu.items.length} className="input" />
                  </Field>
                </div>

                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="visible" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                  Sichtbar
                </label>

                <SubmitButton>Hinzufügen</SubmitButton>
              </>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
