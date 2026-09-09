import type { Metadata } from 'next';
import Link from 'next/link';
import { LogoLockup } from '@/components/brand/Logo';
import { Icons } from '@/components/ui/Icon';
import { getCurrentUser } from '@/lib/auth/session';
import { PERMISSION_CATALOGUE } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Kein Zugriff',
  robots: { index: false, follow: false, nocache: true },
};

type PageProps = { searchParams: Promise<{ benoetigt?: string }> };

/** Verständliche Erklärung, wenn eine Berechtigung fehlt. */
export default async function NoAccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const permission = PERMISSION_CATALOGUE.find((entry) => entry.key === params.benoetigt);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <LogoLockup size={40} suffix="Admin-Dashboard" />
        </div>

        <div className="panel">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-warning)_16%,transparent)] text-[var(--color-warning-text)]">
            <Icons.shield size={20} />
          </span>

          <h1 className="heading-md">Für diesen Bereich fehlt dir die Berechtigung</h1>

          <p className="muted mt-3">
            {permission
              ? `Für diesen Bereich wird die Berechtigung „${permission.name}“ benötigt: ${permission.description}`
              : 'Dieser Bereich ist für deine Rolle nicht freigegeben.'}
          </p>

          {user ? (
            <div className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-ink-subtle)]">Angemeldet als</p>
              <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{user.displayName}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-subtle)]">
                Rollen: {user.roles.length > 0 ? user.roles.map((role) => role.name).join(', ') : 'keine zugewiesen'}
              </p>
            </div>
          ) : null}

          <p className="muted mt-5">
            Wende dich an einen Superadmin, wenn du Zugriff benötigst.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin" className="btn-primary">
              Zur Übersicht
            </Link>
            <Link href="/" className="btn-secondary">
              Zur Website
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
