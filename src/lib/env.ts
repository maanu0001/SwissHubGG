import { z } from 'zod';

/**
 * Zentrale, validierte Konfiguration. Wird ausschliesslich serverseitig gelesen.
 * Fehlkonfigurationen fallen dadurch beim Start auf und nicht erst im Betrieb.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  });

const idList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

/** Hostname einer Adresse, ohne bei einer unbrauchbaren Angabe zu werfen. */
function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL muss gesetzt sein.'),

  /*
    Die öffentliche Adresse der Website. Sie ist die einzige Quelle für
    Weiterleitungen, Canonical-Adressen und den OAuth-Rückruf – und bleibt
    damit konfigurierbar, ein Domainwechsel ist eine reine Einstellung.

    `0.0.0.0` ist eine Bind-Adresse des Servers und keine erreichbare Adresse.
    Sie hier zuzulassen führt zu Weiterleitungen ins Leere, deshalb wird sie
    ausdrücklich abgelehnt.
  */
  APP_URL: z
    .string()
    .url('APP_URL muss eine vollständige URL sein, z. B. https://swisshub.gg')
    .refine(
      (value) => {
        const host = safeHostname(value);
        return host !== '0.0.0.0' && host !== '::' && host !== '[::]';
      },
      'APP_URL darf keine Bind-Adresse sein (0.0.0.0). Trage die öffentliche Adresse ein, z. B. https://swisshub.gg',
    )
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/$/, '')),

  /** Serverseitiges Geheimnis für Session-Token-Hashing und HMACs. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET muss mindestens 32 Zeichen lang sein.'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),

  // --- Discord OAuth2 ---
  DISCORD_CLIENT_ID: z.string().default(''),
  DISCORD_CLIENT_SECRET: z.string().default(''),
  DISCORD_GUILD_ID: z.string().default(''),
  DISCORD_BOT_TOKEN: z.string().default(''),
  DISCORD_ADMIN_ROLE_IDS: idList,
  DISCORD_ALLOWED_USER_IDS: idList,
  /** Diese Discord-IDs erhalten beim ersten Login automatisch die Superadmin-Rolle. */
  DISCORD_BOOTSTRAP_SUPERADMIN_IDS: idList,

  // --- E-Mail ---
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: booleanish.default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM_NAME: z.string().default('SwissHub'),
  MAIL_FROM_ADDRESS: z.string().default(''),

  // --- Speicher ---
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),

  // --- Optionaler CAPTCHA-Schutz (Cloudflare Turnstile) ---
  TURNSTILE_SITE_KEY: z.string().default(''),
  TURNSTILE_SECRET_KEY: z.string().default(''),

  // --- Betrieb ---
  ENABLE_BACKGROUND_JOBS: booleanish.default(true),
  METRICS_ENABLED: booleanish.default(true),
  TRUST_PROXY: booleanish.default(true),
});

export type AppEnv = z.infer<typeof envSchema> & {
  discordRedirectUri: string;
  isProduction: boolean;
  mailConfigured: boolean;
  discordConfigured: boolean;
  captchaConfigured: boolean;
};

let cached: AppEnv | null = null;

function build(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Ungültige Umgebungskonfiguration:\n${issues}`);
  }

  const value = parsed.data;

  return {
    ...value,
    discordRedirectUri: `${value.APP_URL}/admin/login/callback`,
    isProduction: value.NODE_ENV === 'production',
    mailConfigured: value.SMTP_HOST.length > 0 && value.MAIL_FROM_ADDRESS.length > 0,
    discordConfigured:
      value.DISCORD_CLIENT_ID.length > 0 &&
      value.DISCORD_CLIENT_SECRET.length > 0 &&
      value.DISCORD_GUILD_ID.length > 0,
    captchaConfigured: value.TURNSTILE_SITE_KEY.length > 0 && value.TURNSTILE_SECRET_KEY.length > 0,
  };
}

export function env(): AppEnv {
  cached ??= build();
  return cached;
}

/** Nur für Tests: erzwingt ein erneutes Einlesen der Umgebungsvariablen. */
export function resetEnvCache(): void {
  cached = null;
}
