import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ContactPriority, ContactStatus, EmailJobStatus } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { CONTACT_PRIORITY_LABEL, CONTACT_STATUS_META } from '@/app/admin/(dashboard)/kontakt/page';
import {
  addNoteAction,
  anonymiseRequestAction,
  replyAction,
  updateRequestAction,
} from '@/server/actions/contactInbox';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatBytes, formatDateTime } from '@/lib/format';
import { env } from '@/lib/env';

export const metadata = { title: 'Anfrage' };

type PageProps = { params: Promise<{ id: string }> };

const JOB_STATUS_LABEL: Record<EmailJobStatus, { label: string; badge: string }> = {
  PENDING: { label: 'in Warteschlange', badge: 'badge-warning' },
  PROCESSING: { label: 'wird versendet', badge: 'badge-info' },
  SENT: { label: 'zugestellt', badge: 'badge-success' },
  FAILED: { label: 'fehlgeschlagen', badge: 'badge-danger' },
  CANCELLED: { label: 'abgebrochen', badge: 'badge-neutral' },
};

/** Detailansicht einer Kontaktanfrage mit Verlauf, Notizen und Antwortmöglichkeit. */
export default async function AdminContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.CONTACT_READ);
  const canRespond = userHasPermission(user, PERMISSIONS.CONTACT_RESPOND);
  const canDelete = userHasPermission(user, PERMISSIONS.CONTACT_DELETE);

  const request = await prisma.contactRequest.findUnique({
    where: { id },
    include: {
      category: true,
      assignedTo: { select: { id: true, displayName: true } },
      attachments: true,
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { displayName: true } } } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { displayName: true } },
          emailJob: { select: { status: true, sentAt: true, lastError: true, attempts: true } },
        },
      },
    },
  });

  if (!request) notFound();

  const [team, notificationJob, confirmationJob] = await Promise.all([
    prisma.adminUser.findMany({
      where: { isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    }),
    request.notificationJobId
      ? prisma.emailJob.findUnique({
          where: { id: request.notificationJobId },
          select: { status: true, sentAt: true, lastError: true, toAddresses: true },
        })
      : null,
    request.confirmationJobId
      ? prisma.emailJob.findUnique({
          where: { id: request.confirmationJobId },
          select: { status: true, sentAt: true, lastError: true },
        })
      : null,
  ]);

  const status = CONTACT_STATUS_META[request.status];

  return (
    <>
      <PageHeader
        title={request.subject}
        description={`Referenz ${request.reference} · eingegangen am ${formatDateTime(request.createdAt)}`}
        breadcrumb={[{ label: 'Kontaktanfragen', href: '/admin/kontakt' }]}
        actions={<span className={status.badge}>{status.label}</span>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          {request.anonymizedAt ? (
            <InfoBox tone="warning" title="Diese Anfrage wurde anonymisiert">
              Personenbezogene Angaben wurden am {formatDateTime(request.anonymizedAt)} entfernt. Eine Antwort ist
              nicht mehr möglich.
            </InfoBox>
          ) : null}

          <Panel title="Anfrage">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Name</dt>
                <dd className="text-sm text-[var(--color-ink)]">{request.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">E-Mail</dt>
                <dd className="text-sm text-[var(--color-ink)]">
                  {request.anonymizedAt ? (
                    request.email
                  ) : (
                    <a href={`mailto:${request.email}`} className="text-[var(--color-brand-text)] underline underline-offset-2">
                      {request.email}
                    </a>
                  )}
                </dd>
              </div>
              {request.organisation ? (
                <div>
                  <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Organisation</dt>
                  <dd className="text-sm text-[var(--color-ink)]">{request.organisation}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">Kategorie</dt>
                <dd className="text-sm text-[var(--color-ink)]">{request.category?.label ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                  Datenschutz bestätigt
                </dt>
                <dd className="text-sm text-[var(--color-ink)]">{formatDateTime(request.privacyAcceptedAt)}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {request.message}
              </p>
            </div>

            {request.attachments.length > 0 ? (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Anhänge</h3>
                <ul className="space-y-2">
                  {request.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm">
                      <span className="truncate text-[var(--color-ink)]">{attachment.originalName}</span>
                      <span className="flex items-center gap-3 text-xs text-[var(--color-ink-subtle)]">
                        {formatBytes(attachment.byteSize)}
                        <a
                          href={`/api/media/${attachment.storageKey}`}
                          className="text-[var(--color-brand-text)] underline underline-offset-2"
                          download
                        >
                          Herunterladen
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Verlauf">
            <ol className="space-y-4">
              {request.messages.map((message) => (
                <li
                  key={message.id}
                  className={`rounded-lg border p-4 ${
                    message.direction === 'OUTBOUND'
                      ? 'border-[color-mix(in_srgb,var(--color-brand)_40%,transparent)] bg-[var(--color-brand-soft)]'
                      : 'border-[var(--color-line)] bg-[var(--color-canvas)]'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-ink-subtle)]">
                    <span>
                      {message.direction === 'OUTBOUND'
                        ? `Antwort von ${message.author?.displayName ?? 'Team'}`
                        : 'Nachricht der anfragenden Person'}{' '}
                      · {formatDateTime(message.createdAt)}
                    </span>
                    {message.emailJob ? (
                      <span className={JOB_STATUS_LABEL[message.emailJob.status].badge}>
                        {JOB_STATUS_LABEL[message.emailJob.status].label}
                        {message.emailJob.attempts > 1 ? ` (${message.emailJob.attempts} Versuche)` : ''}
                      </span>
                    ) : null}
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-muted)]">
                    {message.body}
                  </p>

                  {message.emailJob?.lastError ? (
                    <p className="mt-2 text-xs text-[var(--color-danger-text)]">
                      Zustellfehler: {message.emailJob.lastError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>

            {canRespond && !request.anonymizedAt ? (
              <ActionForm action={replyAction} resetOnSuccess className="mt-6 space-y-4 border-t border-[var(--color-line)] pt-6">
                {(state) => (
                  <>
                    <h3 className="text-sm font-semibold text-[var(--color-ink)]">Antworten</h3>
                    <input type="hidden" name="requestId" value={request.id} />

                    {!env().mailConfigured ? (
                      <InfoBox tone="warning">
                        Es ist kein SMTP-Server konfiguriert. Die Antwort wird gespeichert, aber erst versendet, sobald
                        der Versand eingerichtet ist.
                      </InfoBox>
                    ) : null}

                    <Field label="Betreff" name="subject">
                      <input
                        id="subject"
                        name="subject"
                        type="text"
                        maxLength={150}
                        defaultValue={`Re: ${request.subject}`}
                        className="input"
                      />
                    </Field>

                    <Field label="Nachricht" name="body" required error={state.fieldErrors?.body}>
                      <textarea id="body" name="body" rows={7} required className="input resize-y" />
                    </Field>

                    <SubmitButton pendingLabel="Wird eingeplant …">Antwort senden</SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Bearbeitung">
            <ActionForm action={updateRequestAction} className="space-y-4">
              {(state) => (
                <>
                  <input type="hidden" name="id" value={request.id} />

                  <Field label="Status" name="status" error={state.fieldErrors?.status}>
                    <select id="status" name="status" defaultValue={request.status} disabled={!canRespond} className="select">
                      {Object.values(ContactStatus).map((value) => (
                        <option key={value} value={value}>
                          {CONTACT_STATUS_META[value].label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priorität" name="priority" error={state.fieldErrors?.priority}>
                    <select id="priority" name="priority" defaultValue={request.priority} disabled={!canRespond} className="select">
                      {Object.values(ContactPriority).map((value) => (
                        <option key={value} value={value}>
                          {CONTACT_PRIORITY_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Zuständig" name="assignedToId">
                    <select id="assignedToId" name="assignedToId" defaultValue={request.assignedToId ?? ''} disabled={!canRespond} className="select">
                      <option value="">Niemand</option>
                      {team.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {canRespond ? <SubmitButton>Speichern</SubmitButton> : null}
                </>
              )}
            </ActionForm>
          </Panel>

          <Panel title="Benachrichtigungen">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                  Team-Benachrichtigung
                </dt>
                <dd>
                  {notificationJob ? (
                    <>
                      <span className={JOB_STATUS_LABEL[notificationJob.status].badge}>
                        {JOB_STATUS_LABEL[notificationJob.status].label}
                      </span>
                      {notificationJob.sentAt ? (
                        <span className="ml-2 text-xs text-[var(--color-ink-subtle)]">
                          {formatDateTime(notificationJob.sentAt)}
                        </span>
                      ) : null}
                      {notificationJob.lastError ? (
                        <p className="mt-1 text-xs text-[var(--color-danger-text)]">{notificationJob.lastError}</p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-ink-subtle)]">
                      Nicht versendet – es war kein Empfänger für diese Kategorie hinterlegt.
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                  Eingangsbestätigung
                </dt>
                <dd>
                  {confirmationJob ? (
                    <>
                      <span className={JOB_STATUS_LABEL[confirmationJob.status].badge}>
                        {JOB_STATUS_LABEL[confirmationJob.status].label}
                      </span>
                      {confirmationJob.lastError ? (
                        <p className="mt-1 text-xs text-[var(--color-danger-text)]">{confirmationJob.lastError}</p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-ink-subtle)]">Deaktiviert oder nicht versendet.</span>
                  )}
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-xs text-[var(--color-ink-subtle)]">
              Empfänger werden unter{' '}
              <Link href="/admin/kontakt/empfaenger" className="text-[var(--color-brand-text)] underline underline-offset-2">
                E-Mail-Empfänger
              </Link>{' '}
              verwaltet.
            </p>
          </Panel>

          <Panel title="Interne Notizen">
            <ul className="mb-4 space-y-3">
              {request.notes.length === 0 ? (
                <li className="text-sm text-[var(--color-ink-subtle)]">Es sind keine Notizen vorhanden.</li>
              ) : (
                request.notes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-[var(--color-line)] p-3">
                    <p className="whitespace-pre-wrap text-sm text-[var(--color-ink-muted)]">{note.body}</p>
                    <p className="mt-1.5 text-xs text-[var(--color-ink-subtle)]">
                      {note.author?.displayName ?? 'Unbekannt'} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))
              )}
            </ul>

            {canRespond ? (
              <ActionForm action={addNoteAction} resetOnSuccess className="space-y-3">
                {(state) => (
                  <>
                    <input type="hidden" name="requestId" value={request.id} />
                    <Field label="Neue Notiz" name="body" error={state.fieldErrors?.body}>
                      <textarea id="body" name="body" rows={3} className="input resize-y" />
                    </Field>
                    <SubmitButton variant="secondary">Notiz speichern</SubmitButton>
                  </>
                )}
              </ActionForm>
            ) : null}
          </Panel>

          {canDelete && !request.anonymizedAt ? (
            <Panel title="Datenschutz">
              <p className="mb-4 text-sm text-[var(--color-ink-muted)]">
                Anonymisieren entfernt personenbezogene Angaben, behält aber Status und Statistik. Löschen entfernt die
                Anfrage vollständig und ist nicht umkehrbar.
              </p>

              <div className="flex flex-col gap-3">
                <ActionForm action={anonymiseRequestAction}>
                  <input type="hidden" name="id" value={request.id} />
                  <input type="hidden" name="mode" value="anonymisieren" />
                  <SubmitButton variant="secondary" confirm="Anfrage anonymisieren? Name, E-Mail und Text werden entfernt.">
                    Anonymisieren
                  </SubmitButton>
                </ActionForm>

                <ActionForm action={anonymiseRequestAction}>
                  <input type="hidden" name="id" value={request.id} />
                  <input type="hidden" name="mode" value="loeschen" />
                  <SubmitButton variant="danger" confirm="Anfrage endgültig löschen? Das lässt sich nicht rückgängig machen.">
                    Endgültig löschen
                  </SubmitButton>
                </ActionForm>
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </>
  );
}
