import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CacheTag, cached, invalidateTags } from '@/lib/cache';

/**
 * Globale Einstellungen der Website.
 *
 * Alle Werte sind im Admin-Dashboard pflegbar. Die hier hinterlegten
 * Standardwerte enthalten ausschliesslich gesicherte Angaben; nicht bestätigte
 * Inhalte (z. B. Vereinsadresse oder Community-Zahlen) bleiben bewusst leer und
 * werden auf der Website erst angezeigt, wenn sie gepflegt sind.
 */

export const communityStatSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(30),
  description: z.string().max(160).optional().default(''),
  published: z.boolean().default(false),
});

export type CommunityStat = z.infer<typeof communityStatSchema>;

export const settingsSchema = z.object({
  siteName: z.string().min(1).max(60).default('SwissHub'),
  motto: z.string().max(120).default('Zäme hock, zäme zocke'),
  tagline: z
    .string()
    .max(200)
    .default('Die Schweizer Gaming-Community – Discord, Turniere und Events aus der ganzen Schweiz.'),

  discordInviteUrl: z.string().max(300).default(''),
  contactEmail: z.string().max(160).default('info@swisshub.gg'),

  // Impressum / Verein – Pflichtangaben werden im Dashboard ergänzt.
  legalEntityName: z.string().max(160).default('SwissHub'),
  legalAddress: z.string().max(400).default(''),
  legalRepresentatives: z.string().max(300).default(''),
  legalRegisterInfo: z.string().max(300).default(''),

  footerText: z
    .string()
    .max(400)
    .default('SwissHub ist ein Schweizer Verein und eine Gaming-Community aus der ganzen Schweiz.'),
  footerNote: z.string().max(200).default(''),

  communityStats: z.array(communityStatSchema).max(6).default([]),

  seoDefaultTitle: z.string().max(70).default('SwissHub – Schweizer Gaming-Community'),
  seoDefaultDescription: z
    .string()
    .max(200)
    .default(
      'SwissHub ist die Schweizer Gaming-Community: gemeinsam spielen, Turniere erleben und neue Leute aus der Schweiz kennenlernen.',
    ),
  seoDefaultImageId: z.string().nullable().default(null),

  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z
    .string()
    .max(400)
    .default('Wir arbeiten gerade an der Website. In Kürze sind wir wieder für dich da.'),

  // Standardmässig aus: die Website setzt keine nicht notwendigen Cookies.
  // Externe Medien werden ohnehin erst nach ausdrücklicher Zustimmung geladen.
  cookieBannerEnabled: z.boolean().default(false),
  cookiePolicyVersion: z.string().max(20).default('1'),

  contactAttachmentsEnabled: z.boolean().default(false),
  contactConfirmationEnabled: z.boolean().default(true),
  contactCaptchaEnabled: z.boolean().default(false),
  contactRetentionDays: z.coerce.number().int().min(0).max(3650).default(730),

  mailFromName: z.string().max(80).default('SwissHub'),
  mailReplyTo: z.string().max(160).default(''),

  sponsorSectionLabel: z.string().max(60).default('Partner & Sponsoren'),
  showSponsorTiers: z.boolean().default(true),
});

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

export async function updateSettings(patch: Partial<SiteSettings>): Promise<void> {
  const entries = Object.entries(patch) as [keyof SiteSettings, unknown][];

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
}

/** Nur veröffentlichte Community-Zahlen erscheinen auf der Website. */
export function publishedStats(settings: SiteSettings): CommunityStat[] {
  return settings.communityStats.filter((stat) => stat.published && stat.value.trim().length > 0);
}
