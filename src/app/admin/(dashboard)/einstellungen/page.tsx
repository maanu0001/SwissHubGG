import { MediaKind } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { MediaSelectField } from '@/components/admin/MediaSelectField';
import {
  toggleFeatureFlagAction,
  updateCommunityStatsAction,
  updateSettingsGroupAction,
} from '@/server/actions/settings';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { getSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export const metadata = { title: 'Einstellungen' };

/** Globale Einstellungen der Website. */
export default async function AdminSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const [settings, media, flags] = await Promise.all([
    getSettings(),
    prisma.mediaAsset.findMany({
      where: { kind: MediaKind.IMAGE },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, originalName: true, title: true, storageKey: true },
    }),
    prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
  ]);

  const config = env();

  return (
    <>
      <PageHeader title="Einstellungen" description="Zentrale Angaben, die auf der gesamten Website wirken." />

      <div className="space-y-6">
        <Panel title="Allgemein">
          <ActionForm action={updateSettingsGroupAction} className="space-y-4">
            {(state) => (
              <>
                <input type="hidden" name="group" value="allgemein" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Website-Name" name="siteName" required>
                    <input id="siteName" name="siteName" type="text" required maxLength={60} defaultValue={settings.siteName} className="input" />
                  </Field>
                  <Field label="Motto" name="motto">
                    <input id="motto" name="motto" type="text" maxLength={120} defaultValue={settings.motto} className="input" />
                  </Field>
                </div>

                <Field label="Kurzbeschreibung" name="tagline" hint="Wird als Ergänzung in Vorschauen verwendet.">
                  <input id="tagline" name="tagline" type="text" maxLength={200} defaultValue={settings.tagline} className="input" />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Discord-Einladungslink"
                    name="discordInviteUrl"
                    error={state.fieldErrors?.discordInviteUrl}
                    hint="Ohne diesen Link werden alle Discord-Schaltflächen ausgeblendet."
                  >
                    <input id="discordInviteUrl" name="discordInviteUrl" type="url" defaultValue={settings.discordInviteUrl} className="input" placeholder="https://discord.gg/…" />
                  </Field>
                  <Field label="Kontaktadresse" name="contactEmail">
                    <input id="contactEmail" name="contactEmail" type="email" maxLength={160} defaultValue={settings.contactEmail} className="input" />
                  </Field>
                </div>

                <SubmitButton>Speichern</SubmitButton>
              </>
            )}
          </ActionForm>
        </Panel>

        <Panel
          title="Community-Zahlen"
          description="Es werden ausschliesslich Werte angezeigt, die ausdrücklich als veröffentlicht markiert sind. Nicht bestätigte Zahlen bleiben unsichtbar."
        >
          <ActionForm action={updateCommunityStatsAction} className="space-y-5">
            <>
              {settings.communityStats.length === 0 ? (
                <InfoBox tone="info" title="Noch keine Zahlen gepflegt">
                  Trage unten reale, überprüfte Werte ein. Solange nichts veröffentlicht ist, blendet die Website den
                  Statistikbereich vollständig aus.
                </InfoBox>
              ) : (
                <ul className="space-y-3">
                  {settings.communityStats.map((stat) => (
                    <li key={stat.id} className="rounded-lg border border-[var(--color-line)] p-4">
                      <input type="hidden" name="statId" value={stat.id} />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Wert" name={`value-${stat.id}`}>
                          <input id={`value-${stat.id}`} name={`value-${stat.id}`} type="text" maxLength={30} defaultValue={stat.value} className="input" />
                        </Field>
                        <Field label="Bezeichnung" name={`label-${stat.id}`}>
                          <input id={`label-${stat.id}`} name={`label-${stat.id}`} type="text" maxLength={60} defaultValue={stat.label} className="input" />
                        </Field>
                        <Field label="Zusatz" name={`description-${stat.id}`}>
                          <input id={`description-${stat.id}`} name={`description-${stat.id}`} type="text" maxLength={160} defaultValue={stat.description ?? ''} className="input" />
                        </Field>
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                        <input type="checkbox" name={`published-${stat.id}`} defaultChecked={stat.published} className="h-4 w-4 accent-[var(--color-brand)]" />
                        Auf der Website anzeigen
                      </label>
                      <p className="mt-2 text-xs text-[var(--color-ink-subtle)]">
                        Zum Entfernen Wert und Bezeichnung leeren und speichern.
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {settings.communityStats.length < 6 ? (
                <div className="rounded-lg border border-dashed border-[var(--color-line-strong)] p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Neue Zahl hinzufügen</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Wert" name="newValue">
                      <input id="newValue" name="newValue" type="text" maxLength={30} className="input" placeholder="z. B. 2021" />
                    </Field>
                    <Field label="Bezeichnung" name="newLabel">
                      <input id="newLabel" name="newLabel" type="text" maxLength={60} className="input" placeholder="z. B. Gegründet" />
                    </Field>
                    <Field label="Zusatz" name="newDescription">
                      <input id="newDescription" name="newDescription" type="text" maxLength={160} className="input" />
                    </Field>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <input type="checkbox" name="newPublished" className="h-4 w-4 accent-[var(--color-brand)]" />
                    Direkt veröffentlichen
                  </label>
                </div>
              ) : null}

              <SubmitButton>Community-Zahlen speichern</SubmitButton>
            </>
          </ActionForm>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Impressum & Verein" description="Pflichtangaben für das Impressum.">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="rechtliches" />

                {!settings.legalAddress ? (
                  <InfoBox tone="warning" title="Pflichtangabe fehlt">
                    Für ein vollständiges Impressum muss mindestens eine Kontaktadresse des Vereins hinterlegt sein.
                  </InfoBox>
                ) : null}

                <Field label="Name des Vereins" name="legalEntityName">
                  <input id="legalEntityName" name="legalEntityName" type="text" maxLength={160} defaultValue={settings.legalEntityName} className="input" />
                </Field>

                <Field label="Adresse" name="legalAddress" hint="Mehrzeilig möglich.">
                  <textarea id="legalAddress" name="legalAddress" rows={3} maxLength={400} defaultValue={settings.legalAddress} className="input resize-y" />
                </Field>

                <Field label="Vertretungsberechtigte Personen" name="legalRepresentatives">
                  <input id="legalRepresentatives" name="legalRepresentatives" type="text" maxLength={300} defaultValue={settings.legalRepresentatives} className="input" />
                </Field>

                <Field label="Registerangaben" name="legalRegisterInfo" hint="Falls vorhanden, z. B. UID oder Handelsregistereintrag.">
                  <input id="legalRegisterInfo" name="legalRegisterInfo" type="text" maxLength={300} defaultValue={settings.legalRegisterInfo} className="input" />
                </Field>

                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="Footer">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="footer" />
                <Field label="Beschreibungstext" name="footerText">
                  <textarea id="footerText" name="footerText" rows={3} maxLength={400} defaultValue={settings.footerText} className="input resize-y" />
                </Field>
                <Field label="Zusatzhinweis" name="footerNote">
                  <input id="footerNote" name="footerNote" type="text" maxLength={200} defaultValue={settings.footerNote} className="input" />
                </Field>
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="SEO-Standardwerte" description="Gelten für Seiten ohne eigene Angaben.">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="seo" />
                <Field label="Standard-Titel" name="seoDefaultTitle" hint="Empfohlen: 50–60 Zeichen.">
                  <input id="seoDefaultTitle" name="seoDefaultTitle" type="text" maxLength={70} defaultValue={settings.seoDefaultTitle} className="input" />
                </Field>
                <Field label="Standard-Beschreibung" name="seoDefaultDescription" hint="Empfohlen: 120–160 Zeichen.">
                  <textarea id="seoDefaultDescription" name="seoDefaultDescription" rows={3} maxLength={200} defaultValue={settings.seoDefaultDescription} className="input resize-y" />
                </Field>
                <MediaSelectField
                  label="Standard-Sharing-Bild"
                  name="seoDefaultImageId"
                  media={media}
                  defaultValue={settings.seoDefaultImageId}
                  hint="Ohne Auswahl wird automatisch ein Bild mit Logo und Titel erzeugt."
                />
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="Kontaktformular">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="kontakt" />

                <label className="flex items-start gap-3">
                  <input type="checkbox" name="contactConfirmationEnabled" defaultChecked={settings.contactConfirmationEnabled} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    Eingangsbestätigung an die anfragende Person senden
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input type="checkbox" name="contactAttachmentsEnabled" defaultChecked={settings.contactAttachmentsEnabled} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    Dateianhänge im Kontaktformular erlauben (Bilder und PDF bis {config.MAX_UPLOAD_MB} MB)
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="contactCaptchaEnabled"
                    defaultChecked={settings.contactCaptchaEnabled}
                    disabled={!config.captchaConfigured}
                    className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    CAPTCHA aktivieren (Cloudflare Turnstile)
                    {!config.captchaConfigured ? (
                      <span className="mt-0.5 block text-xs text-[var(--color-warning-text)]">
                        Setze zuerst TURNSTILE_SITE_KEY und TURNSTILE_SECRET_KEY in der Umgebung.
                      </span>
                    ) : null}
                  </span>
                </label>

                <Field
                  label="Aufbewahrungsfrist (Tage)"
                  name="contactRetentionDays"
                  hint="Ältere Anfragen werden automatisch anonymisiert. 0 deaktiviert die automatische Anonymisierung."
                >
                  <input id="contactRetentionDays" name="contactRetentionDays" type="number" min={0} max={3650} defaultValue={settings.contactRetentionDays} className="input" />
                </Field>

                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="E-Mail-Darstellung">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="email" />
                <Field label="Absendername" name="mailFromName" hint={`Absenderadresse (${config.MAIL_FROM_ADDRESS || 'nicht gesetzt'}) wird aus der Umgebung gelesen.`}>
                  <input id="mailFromName" name="mailFromName" type="text" maxLength={80} defaultValue={settings.mailFromName} className="input" />
                </Field>
                <Field label="Antwortadresse (Reply-To)" name="mailReplyTo">
                  <input id="mailReplyTo" name="mailReplyTo" type="email" maxLength={160} defaultValue={settings.mailReplyTo} className="input" />
                </Field>
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="Sponsoring-Darstellung">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="sponsoring" />
                <Field label="Bezeichnung des Bereichs" name="sponsorSectionLabel">
                  <input id="sponsorSectionLabel" name="sponsorSectionLabel" type="text" maxLength={60} defaultValue={settings.sponsorSectionLabel} className="input" />
                </Field>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="showSponsorTiers" defaultChecked={settings.showSponsorTiers} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Sponsoring-Stufen bei der Sortierung berücksichtigen
                </label>
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="Datenschutz">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="datenschutz" />
                <InfoBox tone="info">
                  Die Website setzt keine Cookies zu Marketing- oder Trackingzwecken. Der Hinweis ist deshalb optional.
                  Externe Videos werden immer erst nach ausdrücklicher Zustimmung geladen.
                </InfoBox>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="cookieBannerEnabled" defaultChecked={settings.cookieBannerEnabled} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Datenschutzhinweis einblenden
                </label>
                <Field label="Version der Datenschutzhinweise" name="cookiePolicyVersion" hint="Beim Erhöhen wird der Hinweis erneut angezeigt.">
                  <input id="cookiePolicyVersion" name="cookiePolicyVersion" type="text" maxLength={20} defaultValue={settings.cookiePolicyVersion} className="input" />
                </Field>
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>

          <Panel title="Wartungsmodus">
            <ActionForm action={updateSettingsGroupAction} className="space-y-4">
              <>
                <input type="hidden" name="group" value="betrieb" />
                {settings.maintenanceMode ? (
                  <InfoBox tone="warning" title="Wartungsmodus ist aktiv">
                    Besucher sehen aktuell nur die Wartungsseite. Angemeldete Admin-Benutzer sehen die Website normal.
                  </InfoBox>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input type="checkbox" name="maintenanceMode" defaultChecked={settings.maintenanceMode} className="h-4 w-4 accent-[var(--color-brand)]" />
                  Wartungsmodus aktivieren
                </label>
                <Field label="Hinweistext" name="maintenanceMessage">
                  <textarea id="maintenanceMessage" name="maintenanceMessage" rows={3} maxLength={400} defaultValue={settings.maintenanceMessage} className="input resize-y" />
                </Field>
                <SubmitButton>Speichern</SubmitButton>
              </>
            </ActionForm>
          </Panel>
        </div>

        {flags.length > 0 ? (
          <Panel title="Feature-Schalter" description="Optionale Bereiche der Website ein- oder ausblenden.">
            <ul className="space-y-3">
              {flags.map((flag) => (
                <li key={flag.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">{flag.label}</p>
                    {flag.description ? (
                      <p className="text-xs text-[var(--color-ink-subtle)]">{flag.description}</p>
                    ) : null}
                  </div>
                  <ActionForm action={toggleFeatureFlagAction}>
                    <input type="hidden" name="key" value={flag.key} />
                    <SubmitButton variant={flag.enabled ? 'secondary' : 'primary'} pendingLabel="…">
                      {flag.enabled ? 'Deaktivieren' : 'Aktivieren'}
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
