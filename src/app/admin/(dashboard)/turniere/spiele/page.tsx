import Link from 'next/link';
import { PageHeader, Panel, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Field } from '@/components/admin/FormField';
import { createGameAction, deleteGameAction, toggleGameAction, updateGameAction } from '@/server/actions/games';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Spiele' };

/**
 * Spiele für Turniere.
 *
 * Die hier gepflegten Einträge füllen die Auswahl im Turnierformular und die
 * Filter auf der öffentlichen Turnierseite. Ein Spiel mit zugeordneten
 * Turnieren lässt sich nicht löschen, sondern nur deaktivieren – die
 * Zuordnungen bleiben dadurch erhalten.
 */
export default async function AdminGamesPage() {
  const user = await requirePermission(PERMISSIONS.TOURNAMENTS_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.TOURNAMENTS_MANAGE);

  const games = await prisma.tournamentGame.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { tournaments: true } } },
  });

  return (
    <>
      <PageHeader
        title="Spiele"
        description="Grundlage für die Zuordnung von Turnieren und für die Filter auf der öffentlichen Turnierseite."
        actions={
          <Link href="/admin/turniere" className="btn-secondary">
            Zu den Turnieren
          </Link>
        }
      />

      <div className="space-y-6">
        {!canManage ? (
          <InfoBox tone="info" title="Nur Leserechte">
            Zum Anlegen und Bearbeiten von Spielen wird die Berechtigung „Turniere verwalten“ benötigt.
          </InfoBox>
        ) : null}

        {games.length === 0 ? (
          <Panel title="Noch keine Spiele">
            <p className="text-sm text-[var(--color-ink-muted)]">
              Lege unten das erste Spiel an. Danach lässt es sich Turnieren zuordnen, und es erscheint als Filter auf
              der Turnierseite.
            </p>
          </Panel>
        ) : (
          games.map((game) => (
            <Panel
              key={game.id}
              title={game.name}
              description={`Adresse: /turniere?spiel=${game.slug} · ${
                game._count.tournaments === 1 ? '1 Turnier' : `${game._count.tournaments} Turniere`
              }`}
              actions={
                canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionForm action={toggleGameAction}>
                      <input type="hidden" name="id" value={game.id} />
                      <SubmitButton variant={game.active ? 'secondary' : 'primary'} pendingLabel="…">
                        {game.active ? 'Deaktivieren' : 'Aktivieren'}
                      </SubmitButton>
                    </ActionForm>

                    {game._count.tournaments === 0 ? (
                      <ActionForm action={deleteGameAction}>
                        <input type="hidden" name="id" value={game.id} />
                        <SubmitButton variant="ghost" pendingLabel="…" confirm={`Spiel „${game.name}“ entfernen?`}>
                          Entfernen
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null
              }
            >
              {!game.active ? (
                <InfoBox tone="warning" title="Deaktiviert">
                  Dieses Spiel erscheint weder in den öffentlichen Filtern noch in der Auswahl neuer Turniere.
                  Bestehende Zuordnungen bleiben bestehen.
                </InfoBox>
              ) : null}

              <ActionForm action={updateGameAction} className="mt-4 space-y-4">
                <>
                  <input type="hidden" name="id" value={game.id} />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" name={`name-${game.id}`} errorKey="name" required>
                      <input
                        id={`name-${game.id}`}
                        name="name"
                        type="text"
                        required
                        maxLength={80}
                        defaultValue={game.name}
                        disabled={!canManage}
                        className="input"
                      />
                    </Field>

                    <Field
                      label="Kurzform"
                      name={`shortName-${game.id}`}
                      errorKey="shortName"
                      hint="Wird auf den Filterschaltflächen angezeigt, z. B. „CS2“."
                    >
                      <input
                        id={`shortName-${game.id}`}
                        name="shortName"
                        type="text"
                        maxLength={20}
                        defaultValue={game.shortName ?? ''}
                        disabled={!canManage}
                        className="input"
                      />
                    </Field>
                  </div>

                  <Field label="Beschreibung" name={`description-${game.id}`} errorKey="description">
                    <input
                      id={`description-${game.id}`}
                      name="description"
                      type="text"
                      maxLength={300}
                      defaultValue={game.description ?? ''}
                      disabled={!canManage}
                      className="input"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Sortierung" name={`sortOrder-${game.id}`} hint="Kleinere Zahlen stehen weiter vorne.">
                      <input
                        id={`sortOrder-${game.id}`}
                        name="sortOrder"
                        type="number"
                        defaultValue={game.sortOrder}
                        disabled={!canManage}
                        className="input"
                      />
                    </Field>

                    <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[var(--color-ink-muted)]">
                      <input
                        type="checkbox"
                        name="active"
                        defaultChecked={game.active}
                        disabled={!canManage}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      Für Turniere und Filter verfügbar
                    </label>
                  </div>

                  {canManage ? <SubmitButton>Speichern</SubmitButton> : null}
                </>
              </ActionForm>
            </Panel>
          ))
        )}

        {canManage ? (
          <Panel title="Neues Spiel" description="Die Adresse wird automatisch aus dem Namen gebildet.">
            <ActionForm action={createGameAction} resetOnSuccess className="space-y-4">
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" name="name" required>
                    <input id="name" name="name" type="text" required maxLength={80} className="input" placeholder="z. B. Rocket League" />
                  </Field>
                  <Field label="Kurzform" name="shortName" hint="Optional – für die Filterschaltfläche.">
                    <input id="shortName" name="shortName" type="text" maxLength={20} className="input" placeholder="z. B. RL" />
                  </Field>
                </div>

                <Field label="Beschreibung" name="description">
                  <input id="description" name="description" type="text" maxLength={300} className="input" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Sortierung" name="sortOrder">
                    <input id="sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
                  </Field>
                  <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-[var(--color-ink-muted)]">
                    <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                    Sofort verfügbar
                  </label>
                </div>

                <SubmitButton>Spiel anlegen</SubmitButton>
              </>
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
