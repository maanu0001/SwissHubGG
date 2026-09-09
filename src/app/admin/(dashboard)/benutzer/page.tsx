import { PageHeader, Panel, InfoBox, DataTable, EmptyRow } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { revokeSessionsAction } from '@/server/actions/auth';
import {
  setRolePermissionsAction,
  setSuperAdminAction,
  setUserRolesAction,
  setUserStatusAction,
} from '@/server/actions/users';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS, permissionGroups } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Benutzer & Rollen' };

/** Verwaltung der Admin-Konten, Rollen und Berechtigungen. */
export default async function AdminUsersPage() {
  const currentUser = await requirePermission(PERMISSIONS.USERS_MANAGE);

  const [users, roles] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
      include: {
        roles: { select: { roleId: true } },
        _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } },
      },
    }),
    prisma.role.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { permissions: { include: { permission: { select: { key: true } } } } },
    }),
  ]);

  const config = env();
  const groups = permissionGroups();

  return (
    <>
      <PageHeader
        title="Benutzer & Rollen"
        description="Zugänge zum Dashboard und ihre Berechtigungen. Änderungen wirken sofort."
      />

      <div className="space-y-6">
        <InfoBox tone="info" title="Zugang zum Dashboard">
          Ein Konto entsteht erst bei der ersten erfolgreichen Anmeldung über Discord. Voraussetzung ist eine
          Mitgliedschaft im konfigurierten SwissHub-Server sowie eine freigegebene Discord-Rolle
          {config.DISCORD_ADMIN_ROLE_IDS.length > 0 ? ` (${config.DISCORD_ADMIN_ROLE_IDS.length} hinterlegt)` : ' (keine hinterlegt)'} oder
          eine ausdrücklich erlaubte Benutzer-ID
          {config.DISCORD_ALLOWED_USER_IDS.length > 0 ? ` (${config.DISCORD_ALLOWED_USER_IDS.length} hinterlegt)` : ' (keine hinterlegt)'}.
          Neue Konten erhalten zunächst nur die Rolle „Nur Lesen“.
        </InfoBox>

        <Panel title={`Konten (${users.length})`}>
          <DataTable headers={['Person', 'Rollen', 'Status', 'Sitzungen', 'Letzte Anmeldung', '']}>
            {users.length === 0 ? (
              <EmptyRow message="Es hat sich noch niemand angemeldet." colSpan={6} />
            ) : (
              users.map((user) => {
                const assigned = new Set(user.roles.map((entry) => entry.roleId));

                return (
                  <tr key={user.id} className="align-top">
                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <p className="font-medium text-[var(--color-ink)]">{user.displayName}</p>
                      <p className="text-xs text-[var(--color-ink-subtle)]">{user.discordTag}</p>
                      <p className="font-mono text-[11px] text-[var(--color-ink-subtle)]">{user.discordId}</p>
                      {user.isSuperAdmin ? <span className="mt-1 inline-block badge-brand text-[10px]">Superadmin</span> : null}
                    </td>

                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <ActionForm action={setUserRolesAction} className="space-y-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="flex flex-col gap-1">
                          {roles.map((role) => (
                            <label key={role.id} className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
                              <input
                                type="checkbox"
                                name="roleIds"
                                value={role.id}
                                defaultChecked={assigned.has(role.id)}
                                className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                              />
                              {role.name}
                            </label>
                          ))}
                        </div>
                        <SubmitButton variant="secondary" className="btn-sm">
                          Rollen speichern
                        </SubmitButton>
                      </ActionForm>
                    </td>

                    <td className="border-b border-[var(--color-line)] px-4 py-3">
                      <span className={user.isActive ? 'badge-success' : 'badge-danger'}>
                        {user.isActive ? 'aktiv' : 'deaktiviert'}
                      </span>

                      <ActionForm action={setUserStatusAction} className="mt-2">
                        <input type="hidden" name="userId" value={user.id} />
                        {user.isActive ? null : <input type="hidden" name="isActive" value="on" />}
                        <SubmitButton
                          variant={user.isActive ? 'danger' : 'secondary'}
                          className="btn-sm"
                          confirm={
                            user.isActive
                              ? `Konto von ${user.displayName} deaktivieren? Alle Sitzungen werden sofort beendet.`
                              : undefined
                          }
                        >
                          {user.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </SubmitButton>
                      </ActionForm>

                      {currentUser.isSuperAdmin ? (
                        <ActionForm action={setSuperAdminAction} className="mt-2">
                          <input type="hidden" name="userId" value={user.id} />
                          {user.isSuperAdmin ? null : <input type="hidden" name="isSuperAdmin" value="on" />}
                          <SubmitButton
                            variant="ghost"
                            className="btn-sm"
                            confirm={
                              user.isSuperAdmin
                                ? `Superadmin-Status von ${user.displayName} entziehen?`
                                : `${user.displayName} zum Superadmin machen? Dieses Konto erhält damit alle Rechte.`
                            }
                          >
                            {user.isSuperAdmin ? 'Superadmin entziehen' : 'Zum Superadmin machen'}
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </td>

                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-ink-muted)]">
                      {user._count.sessions}
                      {user._count.sessions > 0 ? (
                        <ActionForm action={revokeSessionsAction} className="mt-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <SubmitButton variant="ghost" className="btn-sm" confirm={`Alle Sitzungen von ${user.displayName} beenden?`}>
                            Sitzungen beenden
                          </SubmitButton>
                        </ActionForm>
                      ) : null}
                    </td>

                    <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'nie'}
                    </td>

                    <td className="border-b border-[var(--color-line)] px-4 py-3" />
                  </tr>
                );
              })
            )}
          </DataTable>
        </Panel>

        <Panel
          title="Rollen und Berechtigungen"
          description="Berechtigungen lassen sich einzeln steuern. Die Oberfläche blendet gesperrte Bereiche aus – geprüft wird zusätzlich immer serverseitig."
        >
          <div className="space-y-6">
            {roles.map((role) => {
              const active = new Set(role.permissions.map((entry) => entry.permission.key));
              const isSuperadmin = role.key === 'superadmin';

              return (
                <details key={role.id} className="rounded-lg border border-[var(--color-line)] p-4">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--color-ink)]">{role.name}</span>
                    <span className="text-xs text-[var(--color-ink-subtle)]">
                      {isSuperadmin ? 'alle Rechte' : `${active.size} Berechtigung(en)`}
                    </span>
                  </summary>

                  <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{role.description}</p>

                  {isSuperadmin ? (
                    <p className="mt-3 text-sm text-[var(--color-ink-subtle)]">
                      Diese Rolle besitzt grundsätzlich alle Rechte und kann nicht eingeschränkt werden.
                    </p>
                  ) : (
                    <ActionForm action={setRolePermissionsAction} className="mt-4 space-y-4">
                      <input type="hidden" name="roleId" value={role.id} />

                      {groups.map((group) => (
                        <fieldset key={group.group}>
                          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                            {group.group}
                          </legend>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.permissions.map((permission) => (
                              <label key={permission.key} className="flex items-start gap-2 text-sm text-[var(--color-ink-muted)]">
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={permission.key}
                                  defaultChecked={active.has(permission.key)}
                                  className="mt-1 h-3.5 w-3.5 accent-[var(--color-brand)]"
                                />
                                <span>
                                  {permission.name}
                                  <span className="block text-xs text-[var(--color-ink-subtle)]">
                                    {permission.description}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}

                      <SubmitButton>Berechtigungen speichern</SubmitButton>
                    </ActionForm>
                  )}
                </details>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
