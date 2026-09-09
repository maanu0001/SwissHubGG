import { ContactStatus } from '@prisma/client';
import { AdminNav, type AdminNavGroup } from '@/components/admin/AdminNav';
import { logoutAction } from '@/server/actions/auth';
import { requireUser, touchSessionIfNeeded } from '@/lib/auth/adminSession';
import { userHasAnyPermission, userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { Icons } from '@/components/ui/Icon';

/**
 * Layout des Admin-Dashboards.
 *
 * Prüft die Sitzung serverseitig und blendet nur Bereiche ein, für die eine
 * Berechtigung besteht. Die Anmelde- und Fehlerseiten haben ein eigenes Layout
 * und werden hier nicht umschlossen.
 */

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await touchSessionIfNeeded(user.sessionId);

  const openRequests = userHasPermission(user, PERMISSIONS.CONTACT_READ)
    ? await prisma.contactRequest.count({
        where: { status: { in: [ContactStatus.NEW, ContactStatus.IN_PROGRESS] }, archivedAt: null },
      })
    : 0;

  const groups: AdminNavGroup[] = [];

  groups.push({ label: 'Übersicht', items: [{ href: '/admin', label: 'Dashboard' }] });

  const contentItems: AdminNavGroup['items'] = [];
  if (userHasPermission(user, PERMISSIONS.PAGES_VIEW)) contentItems.push({ href: '/admin/seiten', label: 'Seiten' });
  if (userHasPermission(user, PERMISSIONS.NAVIGATION_MANAGE))
    contentItems.push({ href: '/admin/navigation', label: 'Navigation' });
  if (userHasPermission(user, PERMISSIONS.MEDIA_VIEW)) contentItems.push({ href: '/admin/medien', label: 'Medien' });
  if (contentItems.length > 0) groups.push({ label: 'Inhalte', items: contentItems });

  const communityItems: AdminNavGroup['items'] = [];
  if (userHasPermission(user, PERMISSIONS.TOURNAMENTS_VIEW))
    communityItems.push({ href: '/admin/turniere', label: 'Turniere' });
  if (userHasPermission(user, PERMISSIONS.SPONSORS_VIEW))
    communityItems.push({ href: '/admin/sponsoren', label: 'Sponsoren' });
  if (userHasAnyPermission(user, [PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE, PERMISSIONS.SOCIAL_POSTS_MANAGE]))
    communityItems.push({ href: '/admin/social', label: 'Social Media' });
  if (userHasPermission(user, PERMISSIONS.PAGES_EDIT)) communityItems.push({ href: '/admin/team', label: 'Team' });
  if (communityItems.length > 0) groups.push({ label: 'Community', items: communityItems });

  const contactItems: AdminNavGroup['items'] = [];
  if (userHasPermission(user, PERMISSIONS.CONTACT_READ))
    contactItems.push({ href: '/admin/kontakt', label: 'Anfragen', badge: openRequests });
  if (userHasPermission(user, PERMISSIONS.EMAIL_RECIPIENTS_MANAGE))
    contactItems.push({ href: '/admin/kontakt/empfaenger', label: 'E-Mail-Empfänger' });
  if (contactItems.length > 0) groups.push({ label: 'Kontakt', items: contactItems });

  const adminItems: AdminNavGroup['items'] = [];
  if (userHasPermission(user, PERMISSIONS.METRICS_VIEW)) adminItems.push({ href: '/admin/statistik', label: 'Statistik' });
  if (userHasPermission(user, PERMISSIONS.SETTINGS_MANAGE))
    adminItems.push({ href: '/admin/einstellungen', label: 'Einstellungen' });
  if (userHasPermission(user, PERMISSIONS.USERS_MANAGE))
    adminItems.push({ href: '/admin/benutzer', label: 'Benutzer & Rollen' });
  if (userHasPermission(user, PERMISSIONS.AUDIT_VIEW)) adminItems.push({ href: '/admin/audit', label: 'Audit-Log' });
  if (userHasPermission(user, PERMISSIONS.BACKUPS_MANAGE)) adminItems.push({ href: '/admin/system', label: 'System' });
  if (adminItems.length > 0) groups.push({ label: 'Administration', items: adminItems });

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminNav
        groups={groups}
        user={{
          displayName: user.displayName,
          roles: user.roles.map((role) => role.name),
          isSuperAdmin: user.isSuperAdmin,
        }}
        logout={
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]"
            >
              <Icons.close size={14} />
              Abmelden
            </button>
          </form>
        }
      />

      <div className="min-w-0 flex-1">
        <main id="admin-inhalt" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
