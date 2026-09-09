import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MediaKind, TournamentStatus } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox, DataTable, EmptyRow } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { MediaSelectField } from '@/components/admin/MediaSelectField';
import { TOURNAMENT_STATUS_META } from '@/components/site/TournamentCard';
import {
  archiveTournamentAction,
  deleteResultAction,
  deleteTeamAction,
  duplicateTournamentAction,
  publishTournamentAction,
  saveResultAction,
  saveTeamAction,
  setTournamentMediaAction,
  setTournamentSponsorsAction,
  updateTournamentAction,
} from '@/server/actions/tournaments';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { toLocalInputValue } from '@/server/actions/types';

/** Vollständige Bearbeitung eines Turniers. */

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { id }, select: { title: true } });
  return { title: tournament ? tournament.title : 'Turnier' };
}

export default async function AdminTournamentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.TOURNAMENTS_VIEW);
  const canManage = userHasPermission(user, PERMISSIONS.TOURNAMENTS_MANAGE);
  const canPublish = userHasPermission(user, PERMISSIONS.TOURNAMENTS_PUBLISH);

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: { orderBy: [{ seed: 'asc' }, { name: 'asc' }] },
      results: { orderBy: { placement: 'asc' } },
      sponsors: { select: { sponsorId: true } },
      media: { orderBy: { position: 'asc' }, select: { mediaId: true } },
    },
  });

  if (!tournament) notFound();

  const [games, sponsors, media] = await Promise.all([
    prisma.tournamentGame.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.sponsor.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, status: true },
    }),
    prisma.mediaAsset.findMany({
      where: { kind: MediaKind.IMAGE },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { id: true, originalName: true, title: true, storageKey: true },
    }),
  ]);

  const selectedSponsors = new Set(tournament.sponsors.map((entry) => entry.sponsorId));
  const selectedMedia = new Set(tournament.media.map((entry) => entry.mediaId));
  const status = TOURNAMENT_STATUS_META[tournament.status];

  return (
    <>
      <PageHeader
        title={tournament.title}
        description={`Öffentliche Adresse: /turniere/${tournament.slug}`}
        breadcrumb={[{ label: 'Turniere', href: '/admin/turniere' }]}
        actions={
          tournament.publishedAt ? (
            <Link
              href={`/turniere/${tournament.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Öffentlich ansehen
            </Link>
          ) : null
        }
      />

      <div className="mb-6 space-y-4">
        <InfoBox tone={tournament.publishedAt ? 'success' : 'info'}>
          Status: <strong>{status.label}</strong> ·{' '}
          {tournament.publishedAt
            ? `öffentlich seit ${formatDateTime(tournament.publishedAt)}`
            : 'noch nicht öffentlich sichtbar'}
          {tournament.scheduledPublishAt
            ? ` · geplante Veröffentlichung: ${formatDateTime(tournament.scheduledPublishAt)}`
            : ''}
        </InfoBox>

        {canPublish ? (
          <div className="flex flex-wrap gap-3">
            <ActionForm action={publishTournamentAction}>
              <input type="hidden" name="id" value={tournament.id} />
              <SubmitButton pendingLabel="Wird ausgeführt …">
                {tournament.publishedAt ? 'Zurückziehen' : 'Veröffentlichen'}
              </SubmitButton>
            </ActionForm>

            <ActionForm action={duplicateTournamentAction}>
              <input type="hidden" name="id" value={tournament.id} />
              <SubmitButton variant="secondary" pendingLabel="Wird dupliziert …">
                Duplizieren
              </SubmitButton>
            </ActionForm>

            <ActionForm action={archiveTournamentAction}>
              <input type="hidden" name="id" value={tournament.id} />
              <SubmitButton
                variant="danger"
                pendingLabel="Wird ausgeführt …"
                confirm={tournament.archivedAt ? 'Turnier wiederherstellen?' : 'Turnier archivieren?'}
              >
                {tournament.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
              </SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <Panel title="Turnierdaten">
          <ActionForm action={updateTournamentAction} className="space-y-5">
            {(state) => (
              <>
                <input type="hidden" name="id" value={tournament.id} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Titel" name="title" required error={state.fieldErrors?.title}>
                    <input id="title" name="title" type="text" required maxLength={150} defaultValue={tournament.title} disabled={!canManage} className="input" />
                  </Field>

                  <Field label="URL" name="slug" required error={state.fieldErrors?.slug} hint="Beim Ändern wird eine Weiterleitung angelegt.">
                    <input id="slug" name="slug" type="text" required maxLength={80} defaultValue={tournament.slug} disabled={!canManage} className="input font-mono text-sm" />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Status" name="status" required error={state.fieldErrors?.status}>
                    <select id="status" name="status" defaultValue={tournament.status} disabled={!canManage} className="select">
                      {Object.values(TournamentStatus).map((value) => (
                        <option key={value} value={value}>
                          {TOURNAMENT_STATUS_META[value].label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Spiel" name="gameId">
                    <select id="gameId" name="gameId" defaultValue={tournament.gameId ?? ''} disabled={!canManage} className="select">
                      <option value="">Nicht festgelegt</option>
                      {games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Teilnahmeform" name="participantUnit">
                    <select id="participantUnit" name="participantUnit" defaultValue={tournament.participantUnit} disabled={!canManage} className="select">
                      <option value="TEAM">Teams</option>
                      <option value="PLAYER">Einzelspielende</option>
                    </select>
                  </Field>
                </div>

                <Field label="Kurzbeschreibung" name="summary" hint="Erscheint in Übersichten und Vorschauen.">
                  <textarea id="summary" name="summary" rows={2} maxLength={400} defaultValue={tournament.summary ?? ''} disabled={!canManage} className="input resize-y" />
                </Field>

                <Field label="Beschreibung" name="description" hint="Markdown erlaubt: **fett**, ## Titel, - Liste, [Link](https://…).">
                  <textarea id="description" name="description" rows={8} defaultValue={tournament.description ?? ''} disabled={!canManage} className="input resize-y font-mono text-[13px]" />
                </Field>

                <Field label="Regeln" name="rules" hint="Markdown erlaubt.">
                  <textarea id="rules" name="rules" rows={6} defaultValue={tournament.rules ?? ''} disabled={!canManage} className="input resize-y font-mono text-[13px]" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Start" name="startsAt" hint="Zeitzone Europe/Zurich.">
                    <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(tournament.startsAt)} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Ende" name="endsAt" error={state.fieldErrors?.endsAt}>
                    <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(tournament.endsAt)} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Anmeldung ab" name="registrationOpensAt">
                    <input id="registrationOpensAt" name="registrationOpensAt" type="datetime-local" defaultValue={toLocalInputValue(tournament.registrationOpensAt)} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Anmeldung bis" name="registrationClosesAt" error={state.fieldErrors?.registrationClosesAt}>
                    <input id="registrationClosesAt" name="registrationClosesAt" type="datetime-local" defaultValue={toLocalInputValue(tournament.registrationClosesAt)} disabled={!canManage} className="input" />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Format" name="format" hint="z. B. Single Elimination, Bo3">
                    <input id="format" name="format" type="text" maxLength={120} defaultValue={tournament.format ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Maximale Teilnehmerzahl" name="maxParticipants">
                    <input id="maxParticipants" name="maxParticipants" type="number" min={2} max={1024} defaultValue={tournament.maxParticipants ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Reihenfolge" name="sortOrder" hint="Kleinere Werte erscheinen zuerst.">
                    <input id="sortOrder" name="sortOrder" type="number" defaultValue={tournament.sortOrder} disabled={!canManage} className="input" />
                  </Field>
                </div>

                <Field label="Preise / Preisgeld" name="prizeInfo" hint="Beträge in CHF angeben.">
                  <input id="prizeInfo" name="prizeInfo" type="text" maxLength={200} defaultValue={tournament.prizeInfo ?? ''} disabled={!canManage} className="input" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Anmeldeseite" name="registrationUrl" hint="z. B. Battlefy.">
                    <input id="registrationUrl" name="registrationUrl" type="url" defaultValue={tournament.registrationUrl ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Livestream" name="streamUrl" hint="Twitch oder YouTube.">
                    <input id="streamUrl" name="streamUrl" type="url" defaultValue={tournament.streamUrl ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Discord-Link" name="discordUrl" hint="Leer lassen für den allgemeinen Einladungslink.">
                    <input id="discordUrl" name="discordUrl" type="url" defaultValue={tournament.discordUrl ?? ''} disabled={!canManage} className="input" />
                  </Field>
                </div>

                <MediaSelectField
                  label="Banner"
                  name="bannerId"
                  media={media}
                  defaultValue={tournament.bannerId}
                  disabled={!canManage}
                  hint="Wird auf der Turnierkarte und der Detailseite angezeigt."
                />

                <Field label="Ergebniszusammenfassung" name="resultSummary" hint="Markdown erlaubt.">
                  <textarea id="resultSummary" name="resultSummary" rows={4} defaultValue={tournament.resultSummary ?? ''} disabled={!canManage} className="input resize-y font-mono text-[13px]" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Gewinner" name="winnerName" hint="Wird beim Eintragen von Platz 1 automatisch gesetzt.">
                    <input id="winnerName" name="winnerName" type="text" maxLength={120} defaultValue={tournament.winnerName ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Video-Rückblick" name="recapUrl">
                    <input id="recapUrl" name="recapUrl" type="url" defaultValue={tournament.recapUrl ?? ''} disabled={!canManage} className="input" />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="SEO-Titel" name="seoTitle">
                    <input id="seoTitle" name="seoTitle" type="text" maxLength={70} defaultValue={tournament.seoTitle ?? ''} disabled={!canManage} className="input" />
                  </Field>
                  <Field label="Geplante Veröffentlichung" name="scheduledPublishAt">
                    <input id="scheduledPublishAt" name="scheduledPublishAt" type="datetime-local" defaultValue={toLocalInputValue(tournament.scheduledPublishAt)} disabled={!canManage} className="input" />
                  </Field>
                </div>

                <Field label="SEO-Beschreibung" name="seoDescription">
                  <textarea id="seoDescription" name="seoDescription" rows={2} maxLength={200} defaultValue={tournament.seoDescription ?? ''} disabled={!canManage} className="input resize-y" />
                </Field>

                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="featured" defaultChecked={tournament.featured} disabled={!canManage} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Als Highlight hervorheben
                </label>

                {canManage ? <SubmitButton>Turnier speichern</SubmitButton> : null}
              </>
            )}
          </ActionForm>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Teilnehmende" description={`${tournament.teams.length} erfasst`}>
            <ul className="mb-5 space-y-2">
              {tournament.teams.length === 0 ? (
                <li className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Teilnehmenden erfasst.</li>
              ) : (
                tournament.teams.map((team) => (
                  <li key={team.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2">
                    <span className="text-sm text-[var(--color-ink)]">
                      {team.tag ? <span className="mr-1.5 font-semibold text-[var(--color-brand-text)]">{team.tag}</span> : null}
                      {team.name}
                      {team.seed ? <span className="ml-2 text-xs text-[var(--color-ink-subtle)]">Seed {team.seed}</span> : null}
                    </span>
                    {canManage ? (
                      <ActionForm action={deleteTeamAction}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <SubmitButton variant="ghost" pendingLabel="…" confirm={`„${team.name}“ entfernen?`}>
                          Entfernen
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </li>
                ))
              )}
            </ul>

            {canManage ? (
              <ActionForm action={saveTeamAction} resetOnSuccess className="space-y-4 border-t border-[var(--color-line)] pt-5">
                {(state) => (
                  <>
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Name" name="name" required error={state.fieldErrors?.name}>
                        <input id="name" name="name" type="text" required maxLength={100} className="input" />
                      </Field>
                      <Field label="Tag" name="tag">
                        <input id="tag" name="tag" type="text" maxLength={12} className="input" />
                      </Field>
                      <Field label="Seed" name="seed">
                        <input id="seed" name="seed" type="number" min={1} className="input" />
                      </Field>
                    </div>
                    <SubmitButton variant="secondary">Hinzufügen</SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Ergebnisse" description="Platzierungen und Preise des abgeschlossenen Turniers.">
            <DataTable headers={['Platz', 'Name', 'Preis', '']}>
              {tournament.results.length === 0 ? (
                <EmptyRow message="Es sind noch keine Ergebnisse erfasst." colSpan={4} />
              ) : (
                tournament.results.map((result) => (
                  <tr key={result.id}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-semibold text-[var(--color-brand-text)]">
                      {result.placement}.
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-[var(--color-ink)]">
                      {result.displayName}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-[var(--color-ink-muted)]">
                      {result.prize ?? '–'}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right">
                      {canManage ? (
                        <ActionForm action={deleteResultAction}>
                          <input type="hidden" name="resultId" value={result.id} />
                          <SubmitButton variant="ghost" pendingLabel="…" confirm="Ergebnis entfernen?">
                            Entfernen
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>

            {canManage ? (
              <ActionForm action={saveResultAction} resetOnSuccess className="mt-5 space-y-4 border-t border-[var(--color-line)] pt-5">
                {(state) => (
                  <>
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Field label="Platz" name="placement" required error={state.fieldErrors?.placement}>
                        <input id="placement" name="placement" type="number" min={1} required className="input" />
                      </Field>
                      <Field label="Name" name="displayName" required error={state.fieldErrors?.displayName}>
                        <input id="displayName" name="displayName" type="text" required maxLength={120} className="input" />
                      </Field>
                      <Field label="Preis" name="prize">
                        <input id="prize" name="prize" type="text" maxLength={120} className="input" />
                      </Field>
                      <Field label="Team" name="teamId">
                        <select id="teamId" name="teamId" className="select">
                          <option value="">Keine Verknüpfung</option>
                          {tournament.teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <SubmitButton variant="secondary">Ergebnis speichern</SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}
          </Panel>

          <Panel title="Sponsoren des Turniers">
            <ActionForm action={setTournamentSponsorsAction} className="space-y-4">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              {sponsors.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Sponsoren erfasst.</p>
              ) : (
                <ul className="space-y-2">
                  {sponsors.map((sponsor) => (
                    <li key={sponsor.id}>
                      <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                        <input
                          type="checkbox"
                          name="sponsorIds"
                          value={sponsor.id}
                          defaultChecked={selectedSponsors.has(sponsor.id)}
                          disabled={!canManage}
                          className="h-4 w-4 accent-[var(--color-brand)]"
                        />
                        {sponsor.name}
                        {sponsor.status === 'FORMER' ? (
                          <span className="badge-neutral text-[10px]">ehemalig</span>
                        ) : null}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {canManage && sponsors.length > 0 ? <SubmitButton variant="secondary">Zuordnung speichern</SubmitButton> : null}
            </ActionForm>
          </Panel>

          <Panel title="Galerie" description="Bilder für den Rückblick auf der Turnierseite.">
            <ActionForm action={setTournamentMediaAction} className="space-y-4">
              <input type="hidden" name="tournamentId" value={tournament.id} />
              {media.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-subtle)]">
                  Die Medienbibliothek ist leer. Lade zuerst Bilder unter „Medien“ hoch.
                </p>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {media.slice(0, 100).map((asset) => (
                    <label key={asset.id} className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                      <input
                        type="checkbox"
                        name="mediaIds"
                        value={asset.id}
                        defaultChecked={selectedMedia.has(asset.id)}
                        disabled={!canManage}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      <span className="truncate">{asset.title ?? asset.originalName}</span>
                    </label>
                  ))}
                </div>
              )}
              {canManage && media.length > 0 ? <SubmitButton variant="secondary">Galerie speichern</SubmitButton> : null}
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
