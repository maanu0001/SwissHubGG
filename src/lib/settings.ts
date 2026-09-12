import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CacheTag, cached, invalidateTags } from '@/lib/cache';
import { DEFAULT_BRAND_COLOR } from '@/lib/brandColor';

/**
 * Globale Einstellungen der Website.
 *
 * Alle Werte sind im Admin-Dashboard pflegbar. Die hier hinterlegten
 * Standardwerte enthalten ausschliesslich gesicherte Angaben; nicht bestätigte
 * Inhalte (z. B. Vereinsadresse oder Community-Zahlen) bleiben bewusst leer und
 * werden auf der Website erst angezeigt, wenn sie gepflegt sind.
 */

/** Einheitliche, deutschsprachige Meldung für zu lange Eingaben. */
function tooLong(limit: number): string {
  return `Bitte kürze die Eingabe auf höchstens ${limit} Zeichen.`;
}

export const communityStatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Bitte gib eine Bezeichnung an.').max(60, tooLong(60)),
  value: z.string().min(1, 'Bitte gib einen Wert an.').max(30, tooLong(30)),
  description: z.string().max(160, tooLong(160)).optional().default(''),
  published: z.boolean().default(false),
});

export type CommunityStat = z.infer<typeof communityStatSchema>;

export const settingsSchema = z.object({
  siteName: z.string().min(1, 'Bitte gib einen Namen für die Website an.').max(60, tooLong(60)).default('SwissHub'),
  motto: z.string().max(120, tooLong(120)).default('Zäme hock, zäme zocke'),
  tagline: z
    .string()
    .max(200, tooLong(200))
    .default('Die Schweizer Gaming-Community – Discord, Turniere und Events aus der ganzen Schweiz.'),

  discordInviteUrl: z.string().max(300, tooLong(300)).default(''),
  contactEmail: z.string().max(160, tooLong(160)).default('info@swisshub.gg'),

  // Impressum / Verein – Pflichtangaben werden im Dashboard ergänzt.
  legalEntityName: z.string().max(160, tooLong(160)).default('SwissHub'),
  legalAddress: z.string().max(400, tooLong(400)).default(''),
  legalRepresentatives: z.string().max(300, tooLong(300)).default(''),
  legalRegisterInfo: z.string().max(300, tooLong(300)).default(''),

  footerText: z
    .string()
    .max(400, tooLong(400))
    .default('SwissHub ist ein Schweizer Verein und eine Gaming-Community aus der ganzen Schweiz.'),
  footerNote: z.string().max(200, tooLong(200)).default(''),

  communityStats: z
    .array(communityStatSchema)
    .max(6, 'Es können höchstens sechs Community-Zahlen gepflegt werden.')
    .default([]),

  seoDefaultTitle: z.string().max(70, tooLong(70)).default('SwissHub – Schweizer Gaming-Community'),
  seoDefaultDescription: z
    .string()
    .max(200, tooLong(200))
    .default(
      'SwissHub ist die Schweizer Gaming-Community: gemeinsam spielen, Turniere erleben und neue Leute aus der Schweiz kennenlernen.',
    ),
  seoDefaultImageId: z.string().nullable().default(null),

  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z
    .string()
    .max(400, tooLong(400))
    .default('Wir arbeiten gerade an der Website. In Kürze sind wir wieder für dich da.'),

  // Standardmässig aus: die Website setzt keine nicht notwendigen Cookies.
  // Externe Medien werden ohnehin erst nach ausdrücklicher Zustimmung geladen.
  cookieBannerEnabled: z.boolean().default(false),
  cookiePolicyVersion: z.string().max(20, tooLong(20)).default('1'),

  contactAttachmentsEnabled: z.boolean().default(false),
  contactConfirmationEnabled: z.boolean().default(true),
  contactCaptchaEnabled: z.boolean().default(false),
  contactRetentionDays: z.coerce
    .number({ error: 'Bitte gib eine Zahl an.' })
    .int('Bitte gib eine ganze Zahl an.')
    .min(0, 'Die Frist darf nicht negativ sein.')
    .max(3650, 'Die Frist darf höchstens 3650 Tage betragen.')
    .default(730),

  mailFromName: z.string().max(80, tooLong(80)).default('SwissHub'),
  mailReplyTo: z.string().max(160, tooLong(160)).default(''),

  sponsorSectionLabel: z.string().max(60, tooLong(60)).default('Partner & Sponsoren'),
  showSponsorTiers: z.boolean().default(true),

  /**
   * Ein hervorgehobener Partner im Fussbereich. Leer bedeutet: kein Bereich.
   * Ob der gewählte Partner öffentlich sichtbar ist, entscheidet beim Anzeigen
   * erneut die Abfrage – ein zurückgezogener Partner verschwindet dadurch von
   * selbst, ohne dass die Einstellung angefasst werden muss.
   */
  footerSponsorId: z.string().nullable().default(null),

  /**
   * Akzentfarbe der Website. Wirkt ausschliesslich auf Farben; alle übrigen
   * Merkmale des Designsystems bleiben unberührt.
   */
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Bitte gib eine Farbe als Hexwert an, z. B. #83060A.')
    .default(DEFAULT_BRAND_COLOR),
});

export type SettingsKey = keyof SiteSettings;

/** Alle bekannten Einstellungsschlüssel – Grundlage jeder Prüfung. */
export const SETTINGS_KEYS = Object.keys(settingsSchema.shape) as SettingsKey[];

export type SettingsPatchResult =
  | { success: true; data: Partial<SiteSettings> }
  | { success: false; fieldErrors: Record<string, string> };

/**
 * Prüft ausschliesslich die tatsächlich übermittelten Einstellungen.
 *
 * Bewusst **nicht** über `settingsSchema.partial()`: Jedes Feld dieses Schemas
 * trägt einen Standardwert, und ein teilweises Schema setzt diesen für jeden
 * fehlenden Schlüssel ein. Das Ergebnis enthielte dann alle Einstellungen –
 * das Speichern einer einzelnen Gruppe würde sämtliche anderen Gruppen auf
 * ihre Standardwerte zurücksetzen und gepflegte Inhalte (z. B. die
 * Community-Zahlen) stillschweigend löschen.
 *
 * Deshalb wird jeder übergebene Wert einzeln gegen sein eigenes Feldschema
 * geprüft. Was nicht im Formular stand, bleibt in der Datenbank unangetastet.
 */
export function parseSettingsPatch(patch: Record<string, unknown>): SettingsPatchResult {
  const data: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};

  for (const [key, value] of Object.entries(patch)) {
    const field = settingsSchema.shape[key as SettingsKey];

    if (!field) {
      // Kann nur bei einem Programmierfehler auftreten; niemals still schlucken.
      fieldErrors[key] = 'Diese Einstellung ist nicht bekannt.';
      continue;
    }

    const result = field.safeParse(value);
    if (result.success) {
      data[key] = result.data;
    } else {
      const issue = result.error.issues[0];
      fieldErrors[key] = issue?.message ?? 'Der Wert ist ungültig.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return { success: true, data: data as Partial<SiteSettings> };
}

export type SiteSettings = z.infer<typeof settingsSchema>;

export const SETTINGS_GROUPS: Record<keyof SiteSettings, string> = {
  siteName: 'allgemein',
  motto: 'allgemein',
  tagline: 'allgemein',
  discordInviteUrl: 'allgemein',
  contactEmail: 'allgemein',
  legalEntityName: 'rechtliches',
  legalAddress: 'rechtliches',
  legalRepresentatives: 'rechtliches',
  legalRegisterInfo: 'rechtliches',
  footerText: 'footer',
  footerNote: 'footer',
  communityStats: 'community',
  seoDefaultTitle: 'seo',
  seoDefaultDescription: 'seo',
  seoDefaultImageId: 'seo',
  maintenanceMode: 'betrieb',
  maintenanceMessage: 'betrieb',
  cookieBannerEnabled: 'datenschutz',
  cookiePolicyVersion: 'datenschutz',
  contactAttachmentsEnabled: 'kontakt',
  contactConfirmationEnabled: 'kontakt',
  contactCaptchaEnabled: 'kontakt',
  contactRetentionDays: 'kontakt',
  mailFromName: 'email',
  mailReplyTo: 'email',
  sponsorSectionLabel: 'sponsoring',
  showSponsorTiers: 'sponsoring',
  footerSponsorId: 'footer',
  brandColor: 'darstellung',
};

export const DEFAULT_SETTINGS: SiteSettings = settingsSchema.parse({});

async function loadSettings(): Promise<SiteSettings> {
  let rows: { key: string; value: unknown }[] = [];

  try {
    rows = await prisma.globalSetting.findMany();
  } catch (error) {
    // Beim Produktions-Build ist die Datenbank nicht zwingend erreichbar.
    // In diesem Fall greifen die Standardwerte, statt den Build abzubrechen.
    console.warn('Einstellungen konnten nicht geladen werden, Standardwerte werden verwendet:', error);
    return DEFAULT_SETTINGS;
  }

  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    raw[row.key] = row.value;
  }

  const parsed = settingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // Einzelne fehlerhafte Werte dürfen die Website nicht lahmlegen:
  // ungültige Felder fallen auf ihren Standardwert zurück.
  const repaired: Record<string, unknown> = { ...raw };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') delete repaired[key];
  }
  return settingsSchema.parse(repaired);
}

export async function getSettings(): Promise<SiteSettings> {
  return cached('settings:all', [CacheTag.settings], loadSettings, 600);
}

/**
 * Schreibt die übergebenen Einstellungen.
 *
 * Nur die enthaltenen Schlüssel werden angefasst: Vorhandene Zeilen werden
 * aktualisiert, fehlende angelegt (`upsert` über den eindeutigen Schlüssel –
 * es entstehen keine Duplikate). Alles läuft in einer Transaktion, damit bei
 * einem Fehler kein halb gespeicherter Zustand zurückbleibt.
 *
 * @returns die tatsächlich geschriebenen Schlüssel.
 */
export async function updateSettings(patch: Partial<SiteSettings>): Promise<SettingsKey[]> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [SettingsKey, unknown][];

  if (entries.length === 0) return [];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.globalSetting.upsert({
        where: { key },
        create: { key, group: SETTINGS_GROUPS[key] ?? 'allgemein', value: value as never },
        update: { value: value as never },
      }),
    ),
  );

  invalidateTags(CacheTag.settings);
  return entries.map(([key]) => key);
}

/** Nur veröffentlichte Community-Zahlen erscheinen auf der Website. */
export function publishedStats(settings: SiteSettings): CommunityStat[] {
  return settings.communityStats.filter((stat) => stat.published && stat.value.trim().length > 0);
}
