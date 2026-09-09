import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoLockup } from '@/components/brand/Logo';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { Icons } from '@/components/ui/Icon';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Admin-Anmeldung.
 *
 * Bewusst schlicht gehalten und nicht öffentlich verlinkt. Fehlermeldungen sind
 * verständlich, geben aber keine Auskunft darüber, ob eine bestimmte Person
 * existiert oder berechtigt wäre.
 */

export const metadata: Metadata = {
  title: 'Anmeldung',
  robots: { index: false, follow: false, nocache: true },
};

const ERROR_MESSAGES: Record<string, string> = {
  nicht_konfiguriert:
    'Die Discord-Anmeldung ist auf diesem Server noch nicht konfiguriert. Bitte hinterlege die OAuth-Zugangsdaten.',
  zu_viele_versuche: 'Es gab zu viele Anmeldeversuche. Bitte warte einen Moment und versuche es erneut.',
  abgebrochen: 'Die Anmeldung wurde abgebrochen.',
  ungueltiger_status: 'Die Anmeldung ist ungültig oder abgelaufen. Bitte starte sie erneut.',
  abgelaufen: 'Die Anmeldung hat zu lange gedauert. Bitte starte sie erneut.',
  keine_mitgliedschaft: 'Für den Zugang musst du Mitglied des SwissHub-Discords sein.',
  keine_berechtigung: 'Dein Discord-Konto ist für das Dashboard nicht freigeschaltet.',
  konto_deaktiviert: 'Dieses Konto wurde deaktiviert. Bitte wende dich an einen Superadmin.',
  discord_nicht_erreichbar:
    'Discord ist gerade nicht erreichbar, deshalb konnte deine Berechtigung nicht geprüft werden. Bitte versuche es später erneut.',
  anmeldung_fehlgeschlagen: 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.',
  unbekannt: 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.',
};

type PageProps = { searchParams: Promise<{ fehler?: string; next?: string }> };

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (user) {
    redirect('/admin');
  }

  const config = env();
  const error = params.fehler ? (ERROR_MESSAGES[params.fehler] ?? ERROR_MESSAGES.unbekannt) : null;
  const startHref = params.next?.startsWith('/admin')
    ? `/admin/login/start?next=${encodeURIComponent(params.next)}`
    : '/admin/login/start';

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <TechBackdrop variant="hero" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoLockup size={44} priority suffix="Admin-Dashboard" />
        </div>

        <div className="panel corner-ticks relative overflow-hidden">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-40" />
          <div className="relative">
          <p className="meta-brand mb-2">Zugang nur für das Team</p>
          <h1 className="heading-md">Anmeldung</h1>
          <p className="muted mt-2">
            Das Dashboard steht ausschliesslich berechtigten Mitgliedern des SwissHub-Teams offen. Die Anmeldung
            erfolgt über Discord.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] p-3.5 text-sm text-[var(--color-danger-text)]"
            >
              <Icons.alert size={17} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          {config.discordConfigured ? (
            <a href={startHref} className="btn-primary btn-lg mt-6 w-full" rel="nofollow">
              <Icons.discord size={18} />
              Mit Discord anmelden
            </a>
          ) : (
            <p className="mt-6 rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] p-3.5 text-sm text-[var(--color-warning-text)]">
              Discord-OAuth ist nicht konfiguriert. Setze <code>DISCORD_CLIENT_ID</code>,{' '}
              <code>DISCORD_CLIENT_SECRET</code> und <code>DISCORD_GUILD_ID</code> in der Umgebung.
            </p>
          )}

          <p className="mt-6 border-t border-[var(--color-line)] pt-5 text-xs leading-relaxed text-[var(--color-ink-subtle)]">
            Es werden nur dein Discord-Profil und deine Rollen im SwissHub-Server gelesen. Eine Anmeldung allein
            erteilt keine Rechte – diese vergibt ein Superadmin im Dashboard.
          </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-[var(--color-ink-subtle)] hover:text-[var(--color-ink-muted)]">
            Zurück zur Website
          </Link>
        </p>
      </div>
    </main>
  );
}
