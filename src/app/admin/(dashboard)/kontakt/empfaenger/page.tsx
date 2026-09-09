import { PageHeader, Panel, Field, InfoBox, DataTable, EmptyRow } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import {
  deleteRecipientAction,
  saveCategoryAction,
  saveRecipientAction,
  saveTemplateAction,
  sendTestMailAction,
} from '@/server/actions/contactInbox';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { queueHealth } from '@/lib/mail/queue';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'E-Mail-Empfänger' };

/** Konfiguration der Benachrichtigungsempfänger, Kategorien und Vorlagen. */
export default async function AdminRecipientsPage() {
  await requirePermission(PERMISSIONS.EMAIL_RECIPIENTS_MANAGE);

  const [recipients, categories, confirmation, health] = await Promise.all([
    prisma.emailRecipient.findMany({
      orderBy: [{ kind: 'asc' }, { email: 'asc' }],
      include: { categories: { select: { categoryId: true } } },
    }),
    prisma.contactCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.emailTemplate.findUnique({ where: { key: 'contact-confirmation' } }),
    queueHealth(),
  ]);

  const config = env();

  return (
    <>
      <PageHeader
        title="E-Mail-Empfänger & Vorlagen"
        description="Festlegen, wer Benachrichtigungen zu welchen Kategorien erhält, und wie die Eingangsbestätigung aussieht."
        breadcrumb={[{ label: 'Kontaktanfragen', href: '/admin/kontakt' }]}
      />

      <div className="space-y-6">
        {config.mailConfigured ? (
          <InfoBox tone="success" title="E-Mail-Versand ist eingerichtet">
            Warteschlange: {health.pending} offen, {health.failed} fehlgeschlagen, {health.sentLast24h} in den letzten
            24 Stunden versendet.
            {health.oldestPendingAt ? ` Ältester offener Auftrag: ${formatDateTime(health.oldestPendingAt)}.` : ''}
          </InfoBox>
        ) : (
          <InfoBox tone="warning" title="Kein SMTP-Server konfiguriert">
            Setze <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> und{' '}
            <code>MAIL_FROM_ADDRESS</code> in der Umgebung. Bis dahin werden Nachrichten gespeichert, aber nicht
            versendet. Zugangsdaten werden bewusst nicht in der Datenbank abgelegt.
          </InfoBox>
        )}

        <Panel title={`Empfänger (${recipients.length})`} description="Diese Adressen sind öffentlich nicht sichtbar.">
          <DataTable headers={['Adresse', 'Typ', 'Kategorien', 'Status', '']}>
            {recipients.length === 0 ? (
              <EmptyRow
                message="Es sind noch keine Empfänger hinterlegt. Ohne Empfänger werden keine Benachrichtigungen versendet."
                colSpan={5}
              />
            ) : (
              recipients.map((recipient) => {
                const assigned = new Set(recipient.categories.map((entry) => entry.categoryId));

                return (
                  <tr key={recipient.id}>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <p className="text-[var(--color-ink)]">{recipient.email}</p>
                      {recipient.name ? (
                        <p className="text-xs text-[var(--color-ink-subtle)]">{recipient.name}</p>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                      {recipient.kind}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {recipient.allCategories
                        ? 'Alle Kategorien'
                        : categories
                            .filter((category) => assigned.has(category.id))
                            .map((category) => category.label)
                            .join(', ') || 'Keine'}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <span className={recipient.active ? 'badge-success' : 'badge-neutral'}>
                        {recipient.active ? 'aktiv' : 'inaktiv'}
                      </span>
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-right">
                      <ActionForm action={deleteRecipientAction}>
                        <input type="hidden" name="id" value={recipient.id} />
                        <SubmitButton variant="ghost" pendingLabel="…" confirm={`${recipient.email} entfernen?`}>
                          Entfernen
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>

          <ActionForm action={saveRecipientAction} resetOnSuccess className="mt-6 space-y-4 border-t border-[var(--color-line)] pt-6">
            <>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Empfänger hinzufügen</h3>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="E-Mail-Adresse" name="email" required>
                  <input id="email" name="email" type="email" required className="input" />
                </Field>
                <Field label="Name" name="name">
                  <input id="name" name="name" type="text" maxLength={100} className="input" />
                </Field>
                <Field label="Typ" name="kind" hint="CC und BCC nur verwenden, wenn wirklich nötig.">
                  <select id="kind" name="kind" className="select">
                    <option value="TO">An (TO)</option>
                    <option value="CC">Kopie (CC)</option>
                    <option value="BCC">Blindkopie (BCC)</option>
                  </select>
                </Field>
              </div>

              <fieldset>
                <legend className="field-label">Kategorien</legend>
                <label className="mb-2 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="allCategories" className="h-4 w-4 accent-[var(--color-brand)]" />
                  Alle Kategorien (überschreibt die Einzelauswahl)
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink-muted)]"
                    >
                      <input type="checkbox" name="categoryIds" value={category.id} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
                      {category.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                Aktiv
              </label>

              <SubmitButton>Empfänger speichern</SubmitButton>
            </>
          </ActionForm>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Kontaktkategorien" description="Bestimmen die Auswahl im Kontaktformular und das Routing.">
            <ul className="mb-5 space-y-2">
              {categories.map((category) => (
                <li key={category.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[var(--color-ink)]">{category.label}</span>
                    <span className={category.active ? 'badge-success' : 'badge-neutral'}>
                      {category.active ? 'aktiv' : 'inaktiv'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-subtle)]">Schlüssel: {category.key}</p>
                </li>
              ))}
            </ul>

            <ActionForm action={saveCategoryAction} resetOnSuccess className="space-y-3 border-t border-[var(--color-line)] pt-5">
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bezeichnung" name="label" required>
                    <input id="label" name="label" type="text" required maxLength={80} className="input" />
                  </Field>
                  <Field label="Schlüssel" name="key" required hint="Kleinbuchstaben, z. B. sponsoring.">
                    <input id="key" name="key" type="text" required maxLength={40} className="input font-mono text-sm" />
                  </Field>
                </div>
                <Field label="Beschreibung" name="description">
                  <input id="description" name="description" type="text" maxLength={200} className="input" />
                </Field>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                  Aktiv
                </label>
                <SubmitButton variant="secondary">Kategorie speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <div className="space-y-6">
            <Panel title="Eingangsbestätigung" description="Wird an die anfragende Person gesendet, sofern aktiviert.">
              <ActionForm action={saveTemplateAction} className="space-y-4">
                <>
                  <input type="hidden" name="key" value="contact-confirmation" />
                  <input type="hidden" name="name" value="Eingangsbestätigung" />

                  <Field label="Betreff" name="subject" required>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      required
                      maxLength={150}
                      defaultValue={confirmation?.subject ?? 'Wir haben deine Anfrage erhalten ({{reference}})'}
                      className="input"
                    />
                  </Field>

                  <Field
                    label="Text"
                    name="bodyMarkdown"
                    required
                    hint="Platzhalter: {{name}}, {{subject}}, {{reference}}, {{kategorie}}, {{siteName}}. Markdown erlaubt."
                  >
                    <textarea
                      id="bodyMarkdown"
                      name="bodyMarkdown"
                      rows={8}
                      required
                      defaultValue={
                        confirmation?.bodyMarkdown ??
                        'Hallo {{name}}\n\nDanke für deine Nachricht an {{siteName}}. Wir haben deine Anfrage erhalten und melden uns so bald wie möglich.\n\nDeine Referenz lautet **{{reference}}**.'
                      }
                      className="input resize-y font-mono text-[13px]"
                    />
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={confirmation?.active ?? true}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    Vorlage aktiv
                  </label>

                  <SubmitButton>Vorlage speichern</SubmitButton>
                </>
              </ActionForm>
            </Panel>

            <Panel title="Testmail" description="Prüft die SMTP-Verbindung und den Versandweg.">
              <ActionForm action={sendTestMailAction} className="space-y-4">
                <>
                  <Field label="Empfänger" name="to" required>
                    <input id="to" name="to" type="email" required className="input" />
                  </Field>
                  <SubmitButton variant="secondary" pendingLabel="Wird geprüft …">
                    Testmail senden
                  </SubmitButton>
                </>
              </ActionForm>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
