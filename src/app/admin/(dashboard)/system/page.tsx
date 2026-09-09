import { EmailJobStatus } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox, StatCard, DataTable, EmptyRow } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { deleteRedirectAction, runSchedulerNowAction, saveRedirectAction } from '@/server/actions/settings';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { queueHealth } from '@/lib/mail/queue';
import { cacheStats } from '@/lib/cache';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'System' };

/** Betriebsübersicht: Warteschlange, Weiterleitungen, Backups und Konfiguration. */
export default async function AdminSystemPage() {
  await requirePermission(PERMISSIONS.BACKUPS_MANAGE);

  const [health, failedJobs, redirects, counts] = await Promise.all([
    queueHealth(),
    prisma.emailJob.findMany({
      where: { status: EmailJobStatus.FAILED },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, attempts: true, lastError: true, updatedAt: true },
    }),
    prisma.redirect.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    Promise.all([
      prisma.page.count(),
      prisma.tournament.count(),
      prisma.sponsor.count(),
      prisma.mediaAsset.count(),
      prisma.contactRequest.count(),
      prisma.auditLog.count(),
    ]),
  ]);

  const [pageCount, tournamentCount, sponsorCount, mediaCount, requestCount, auditCount] = counts;
  const config = env();
  const cache = cacheStats();

  return (
    <>
      <PageHeader title="System & Betrieb" description="Zustand der Anwendung, Weiterleitungen und Betriebshinweise." />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Seiten" value={pageCount} />
          <StatCard label="Turniere" value={tournamentCount} />
          <StatCard label="Partner" value={sponsorCount} />
          <StatCard label="Medien" value={mediaCount} />
          <StatCard label="Kontaktanfragen" value={requestCount} />
          <StatCard label="Audit-Einträge" value={auditCount} />
        </div>

        <Panel
          title="E-Mail-Warteschlange"
          description="Ein Hintergrundlauf verarbeitet die Warteschlange automatisch jede Minute."
          actions={
            <ActionForm action={runSchedulerNowAction}>
              <SubmitButton variant="secondary" pendingLabel="Läuft …">
                Hintergrundlauf jetzt ausführen
              </SubmitButton>
            </ActionForm>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Offen" value={health.pending} tone={health.pending > 20 ? 'warning' : 'default'} />
            <StatCard label="Fehlgeschlagen" value={health.failed} tone={health.failed > 0 ? 'danger' : 'default'} />
            <StatCard label="Versendet (24 h)" value={health.sentLast24h} tone="success" />
          </div>

          {failedJobs.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Fehlgeschlagene Aufträge</h3>
              <DataTable headers={['Betreff', 'Versuche', 'Fehler', 'Zuletzt']}>
                {failedJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink)]">
                      {job.subject}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-muted)]">
                      {job.attempts}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-xs text-[var(--color-danger-text)]">
                      {job.lastError}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-xs text-[var(--color-ink-muted)]">
                      {formatDateTime(job.updatedAt)}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          ) : null}
        </Panel>

        <Panel title="Weiterleitungen" description="Werden beim Ändern von Seiten- und Turnier-URLs automatisch angelegt.">
          <DataTable headers={['Von', 'Nach', 'Code', 'Aufrufe', 'Status', '']}>
            {redirects.length === 0 ? (
              <EmptyRow message="Es sind keine Weiterleitungen eingerichtet." colSpan={6} />
            ) : (
              redirects.map((entry) => (
                <tr key={entry.id}>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-xs text-[var(--color-ink-muted)]">
                    {entry.source}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-xs text-[var(--color-ink-muted)]">
                    {entry.destination}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-muted)]">
                    {entry.statusCode}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-sm text-[var(--color-ink-muted)]">
                    {entry.hits}
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5">
                    <span className={entry.active ? 'badge-success' : 'badge-neutral'}>
                      {entry.active ? 'aktiv' : 'inaktiv'}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right">
                    <ActionForm action={deleteRedirectAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <SubmitButton variant="ghost" pendingLabel="…" confirm={`Weiterleitung ${entry.source} entfernen?`}>
                        Entfernen
                      </SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))
            )}
          </DataTable>

          <ActionForm action={saveRedirectAction} resetOnSuccess className="mt-6 space-y-4 border-t border-[var(--color-line)] pt-6">
            {(state) => (
              <>
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">Weiterleitung hinzufügen</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Von (interner Pfad)" name="source" required error={state.fieldErrors?.source}>
                    <input id="source" name="source" type="text" required className="input font-mono text-sm" placeholder="/alte-seite" />
                  </Field>
                  <Field label="Nach" name="destination" required error={state.fieldErrors?.destination}>
                    <input id="destination" name="destination" type="text" required className="input font-mono text-sm" placeholder="/neue-seite" />
                  </Field>
                  <Field label="Statuscode" name="statusCode">
                    <select id="statusCode" name="statusCode" className="select">
                      <option value="308">308 – dauerhaft</option>
                      <option value="307">307 – vorübergehend</option>
                    </select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                  Aktiv
                </label>
                <SubmitButton>Weiterleitung speichern</SubmitButton>
              </>
            )}
          </ActionForm>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Konfiguration" description="Aus der Umgebung gelesen. Zugangsdaten werden nie angezeigt.">
            <dl className="space-y-2 text-sm">
              {[
                { label: 'Umgebung', value: config.NODE_ENV },
                { label: 'Öffentliche Adresse', value: config.APP_URL },
                { label: 'Discord-OAuth', value: config.discordConfigured ? 'konfiguriert' : 'nicht konfiguriert' },
                { label: 'SMTP-Versand', value: config.mailConfigured ? 'konfiguriert' : 'nicht konfiguriert' },
                { label: 'CAPTCHA', value: config.captchaConfigured ? 'konfiguriert' : 'nicht konfiguriert' },
                { label: 'Statistik', value: config.METRICS_ENABLED ? 'aktiv' : 'deaktiviert' },
                { label: 'Hintergrundjobs', value: config.ENABLE_BACKGROUND_JOBS ? 'aktiv' : 'deaktiviert' },
                { label: 'Sitzungsdauer', value: `${config.SESSION_TTL_HOURS} Stunden` },
                { label: 'Maximale Uploadgrösse', value: `${config.MAX_UPLOAD_MB} MB` },
                { label: 'Speicherverzeichnis', value: config.STORAGE_DIR },
                { label: 'Zwischenspeicher', value: `${cache.entries} Einträge` },
              ].map((entry) => (
                <div key={entry.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line)] pb-2 last:border-0">
                  <dt className="text-[var(--color-ink-subtle)]">{entry.label}</dt>
                  <dd className="text-right font-mono text-xs text-[var(--color-ink)]">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Backups">
            <InfoBox tone="info" title="Backups laufen ausserhalb der Anwendung">
              Datenbank und Medien werden über die mitgelieferten Skripte gesichert. Die Anwendung schreibt bewusst
              keine Backups in ihr eigenes Verzeichnis und legt keine Sicherungen im Git-Repository ab.
            </InfoBox>

            <div className="mt-4 space-y-3 text-sm text-[var(--color-ink-muted)]">
              <div>
                <p className="font-medium text-[var(--color-ink)]">Sicherung erstellen</p>
                <code className="mt-1 block overflow-x-auto rounded bg-[var(--color-canvas)] p-2 text-xs">
                  ./scripts/backup.sh
                </code>
              </div>
              <div>
                <p className="font-medium text-[var(--color-ink)]">Sicherung zurückspielen</p>
                <code className="mt-1 block overflow-x-auto rounded bg-[var(--color-canvas)] p-2 text-xs">
                  ./scripts/restore.sh backups/swisshub-JJJJMMTT-HHMM
                </code>
              </div>
              <p className="text-xs text-[var(--color-ink-subtle)]">
                Details, Aufbewahrungsstrategie und Prüfschritte stehen in <code>docs/backup.md</code>.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
