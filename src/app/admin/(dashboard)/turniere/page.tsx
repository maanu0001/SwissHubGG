import Link from 'next/link';
import { PageHeader, Panel, DataTable, EmptyRow, Field } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { createTournamentAction, saveGameAction } from '@/server/actions/tournaments';
import { TOURNAMENT_STATUS_META } from '@/components/site/TournamentCard';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateRange } from '@/lib/format';

export const metadata = { title: 'Turniere' };

/** Übersicht und Anlage von Turnieren sowie Pflege der Spiele. */
export default async function AdminTournamentsPage() {
  const user = await requirePermission(PERMISSIONS.TOURNAMENTS_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.TOURNAMENTS_MANAGE);

  const [tournaments, games] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        startsAt: true,
        endsAt: true,
        publishedAt: true,
        archivedAt: true,
        featured: true,
        game: { select: { name: true, shortName: true } },
        _count: { select: { teams: true, results: true } },
      },
    }),
    prisma.tournamentGame.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);

  return (
    <>
      <PageHeader
        title="Turniere"
        description="Turniere planen, Ergebnisse pflegen und veröffentlichen. Vergangene Turniere bleiben als Archiv erhalten."
      />

      <div className="space-y-6">
        <Panel title={`Alle Turniere (${tournaments.length})`}>
          <DataTable headers={['Turnier', 'Spiel', 'Zeitraum', 'Status', 'Sichtbar', 'Teilnehmer', '']}>
            {tournaments.length === 0 ? (
              <EmptyRow message="Es sind noch keine Turniere erfasst." colSpan={7} />
            ) : (
              tournaments.map((tournament) => {
                const status = TOURNAMENT_STATUS_META[tournament.status];

                return (
                  <tr key={tournament.id} className="hover:bg-[var(--color-surface-raised)]">
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <Link
                        href={`/admin/turniere/${tournament.id}`}
                        className="font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-text)]"
                      >
                        {tournament.title}
                      </Link>
                      {tournament.featured ? <span className="ml-2 badge-brand text-[10px]">Highlight</span> : null}
                      {tournament.archivedAt ? <span className="ml-2 badge-neutral text-[10px]">Archiv</span> : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                      {tournament.game?.shortName ?? tournament.game?.name ?? '–'}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {formatDateRange(tournament.startsAt, tournament.endsAt)}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <span className={status.badge}>{status.label}</span>
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      {tournament.publishedAt ? (
                        <span className="badge-success">öffentlich</span>
                      ) : (
                        <span className="badge-neutral">intern</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                      {tournament._count.teams} / {tournament._count.results} Ergebnisse
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-right">
                      <Link href={`/admin/turniere/${tournament.id}`} className="btn-secondary btn-sm">
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>
        </Panel>

        {canManage ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Neues Turnier" description="Wird als Entwurf angelegt und ist zunächst nicht öffentlich.">
              <ActionForm action={createTournamentAction} className="space-y-4">
                <>
                  <Field label="Titel" name="title" required>
                    <input id="title" name="title" type="text" required maxLength={150} className="input" />
                  </Field>

                  <Field label="URL" name="slug" hint="Leer lassen, um sie aus dem Titel abzuleiten.">
                    <input id="slug" name="slug" type="text" maxLength={80} className="input font-mono text-sm" />
                  </Field>

                  <Field label="Spiel" name="gameId">
                    <select id="gameId" name="gameId" className="select">
                      <option value="">Noch nicht festgelegt</option>
                      {games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <SubmitButton pendingLabel="Wird angelegt …">Turnier anlegen</SubmitButton>
                </>
              </ActionForm>
            </Panel>

            <Panel title="Spiele" description="Kategorien für Turniere. Inaktive Spiele erscheinen nicht im Filter.">
              <ul className="mb-5 space-y-2">
                {games.length === 0 ? (
                  <li className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Spiele erfasst.</li>
                ) : (
                  games.map((game) => (
                    <li
                      key={game.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--color-ink)]">
                        {game.name}
                        {game.shortName ? (
                          <span className="ml-2 text-xs text-[var(--color-ink-subtle)]">({game.shortName})</span>
                        ) : null}
                      </span>
                      <span className={game.active ? 'badge-success' : 'badge-neutral'}>
                        {game.active ? 'aktiv' : 'inaktiv'}
                      </span>
                    </li>
                  ))
                )}
              </ul>

              <ActionForm action={saveGameAction} resetOnSuccess className="space-y-4 border-t border-[var(--color-line)] pt-5">
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" name="name" required>
                      <input id="name" name="name" type="text" required maxLength={80} className="input" placeholder="Counter-Strike 2" />
                    </Field>
                    <Field label="Kurzform" name="shortName">
                      <input id="shortName" name="shortName" type="text" maxLength={20} className="input" placeholder="CS2" />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Reihenfolge" name="sortOrder">
                      <input id="sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
                    </Field>
                    <label className="flex items-end gap-2 pb-2.5 text-sm text-[var(--color-ink-muted)]">
                      <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                      Aktiv
                    </label>
                  </div>

                  <SubmitButton variant="secondary">Spiel hinzufügen</SubmitButton>
                </>
              </ActionForm>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
