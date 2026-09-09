import { MediaKind, SocialPlatform, SocialPostType } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox, DataTable, EmptyRow } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { MediaSelectField } from '@/components/admin/MediaSelectField';
import { SOCIAL_PLATFORM_META, SOCIAL_POST_TYPE_LABEL } from '@/components/site/socialMeta';
import {
  deleteAccountAction,
  deletePostAction,
  publishPostAction,
  saveAccountAction,
  savePostAction,
} from '@/server/actions/social';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDate, formatNumber } from '@/lib/format';
import { toLocalInputValue } from '@/server/actions/types';

export const metadata = { title: 'Social Media' };

/** Verwaltung der Plattform-Accounts und der kuratierten Beiträge. */
export default async function AdminSocialPage() {
  const user = await requirePermission(PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE);
  const canPosts = userHasPermission(user, PERMISSIONS.SOCIAL_POSTS_MANAGE);

  const [accounts, posts, media] = await Promise.all([
    prisma.socialAccount.findMany({ orderBy: [{ sortOrder: 'asc' }, { platform: 'asc' }] }),
    prisma.socialPost.findMany({
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 60,
      select: {
        id: true,
        title: true,
        platform: true,
        type: true,
        url: true,
        featured: true,
        publishedAt: true,
        postedAt: true,
      },
    }),
    prisma.mediaAsset.findMany({
      where: { kind: MediaKind.IMAGE },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, originalName: true, title: true, storageKey: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Social Media"
        description="Accounts und kuratierte Beiträge, die auf der Website erscheinen."
      />

      <div className="space-y-6">
        <InfoBox tone="info" title="Kein automatisches Veröffentlichen">
          Diese Verwaltung pflegt die Account-Links und die auf der Website dargestellten Beiträge. Beiträge auf
          Instagram, TikTok, YouTube oder Twitch werden weiterhin direkt auf den Plattformen erstellt. Eine echte
          Publishing-Anbindung wäre nur mit den offiziellen APIs und passenden Zugangsdaten möglich – das Datenmodell
          ist dafür vorbereitet, es laufen aber bewusst keine Hintergrundabfragen.
        </InfoBox>

        <Panel title={`Accounts (${accounts.length})`}>
          <ul className="mb-6 space-y-3">
            {accounts.length === 0 ? (
              <li className="text-sm text-[var(--color-ink-subtle)]">Es sind noch keine Accounts erfasst.</li>
            ) : (
              accounts.map((account) => (
                <li key={account.id} className="rounded-lg border border-[var(--color-line)] p-4">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-ink)]">
                        {SOCIAL_PLATFORM_META[account.platform].label} · {account.handle}
                      </span>
                      <span className="flex items-center gap-2">
                        {typeof account.followerCount === 'number' ? (
                          <span className="text-xs text-[var(--color-ink-subtle)]">
                            {formatNumber(account.followerCount)} Follower
                          </span>
                        ) : null}
                        <span className={account.active ? 'badge-success' : 'badge-neutral'}>
                          {account.active ? 'sichtbar' : 'ausgeblendet'}
                        </span>
                      </span>
                    </summary>

                    <ActionForm action={saveAccountAction} className="mt-4 space-y-4">
                      <>
                        <input type="hidden" name="id" value={account.id} />

                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="Plattform" name={`platform-${account.id}`} errorKey="platform">
                            <select id={`platform-${account.id}`} name="platform" defaultValue={account.platform} className="select">
                              {Object.values(SocialPlatform).map((platform) => (
                                <option key={platform} value={platform}>
                                  {SOCIAL_PLATFORM_META[platform].label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Benutzername" name={`handle-${account.id}`} errorKey="handle" required>
                            <input id={`handle-${account.id}`} name="handle" type="text" required defaultValue={account.handle} className="input" />
                          </Field>
                          <Field label="Reihenfolge" name={`sortOrder-${account.id}`} errorKey="sortOrder">
                            <input id={`sortOrder-${account.id}`} name="sortOrder" type="number" defaultValue={account.sortOrder} className="input" />
                          </Field>
                        </div>

                        <Field label="Profiladresse" name={`profileUrl-${account.id}`} errorKey="profileUrl" required>
                          <input id={`profileUrl-${account.id}`} name="profileUrl" type="url" required defaultValue={account.profileUrl} className="input" />
                        </Field>

                        <Field label="Beschreibung" name={`description-${account.id}`} errorKey="description">
                          <textarea id={`description-${account.id}`} name="description" rows={2} maxLength={300} defaultValue={account.description ?? ''} className="input resize-y" />
                        </Field>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Followerzahl" name={`followerCount-${account.id}`} errorKey="followerCount" hint="Optional und manuell gepflegt. Leer lassen, um nichts anzuzeigen.">
                            <input id={`followerCount-${account.id}`} name="followerCount" type="number" min={0} defaultValue={account.followerCount ?? ''} className="input" />
                          </Field>
                          <label className="flex items-end gap-2 pb-2.5 text-sm text-[var(--color-ink-muted)]">
                            <input type="checkbox" name="active" defaultChecked={account.active} className="h-4 w-4 accent-[var(--color-brand)]" />
                            Auf der Website anzeigen
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <SubmitButton variant="secondary">Speichern</SubmitButton>
                        </div>
                      </>
                    </ActionForm>

                    <ActionForm action={deleteAccountAction} className="mt-3">
                      <input type="hidden" name="id" value={account.id} />
                      <SubmitButton variant="danger" pendingLabel="…" confirm={`Account „${account.handle}“ löschen?`}>
                        Account löschen
                      </SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              ))
            )}
          </ul>

          <ActionForm action={saveAccountAction} resetOnSuccess className="space-y-4 border-t border-[var(--color-line)] pt-6">
            <>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Neuen Account hinzufügen</h3>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Plattform" name="platform" required>
                  <select id="platform" name="platform" className="select">
                    {Object.values(SocialPlatform).map((platform) => (
                      <option key={platform} value={platform}>
                        {SOCIAL_PLATFORM_META[platform].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Benutzername" name="handle" required>
                  <input id="handle" name="handle" type="text" required className="input" placeholder="@swisshub" />
                </Field>
                <Field label="Reihenfolge" name="sortOrder">
                  <input id="sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
                </Field>
              </div>

              <Field label="Profiladresse" name="profileUrl" required>
                <input id="profileUrl" name="profileUrl" type="url" required className="input" placeholder="https://…" />
              </Field>

              <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[var(--color-brand)]" />
                Auf der Website anzeigen
              </label>

              <SubmitButton>Account hinzufügen</SubmitButton>
            </>
          </ActionForm>
        </Panel>

        {canPosts ? (
          <>
            <Panel title={`Kuratierte Beiträge (${posts.length})`}>
              <DataTable headers={['Titel', 'Plattform', 'Art', 'Datum', 'Sichtbar', '']}>
                {posts.length === 0 ? (
                  <EmptyRow message="Es sind noch keine Beiträge erfasst." colSpan={6} />
                ) : (
                  posts.map((post) => (
                    <tr key={post.id}>
                      <td className="border-b border-[var(--color-line)] px-4 py-3">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-ink)] hover:text-[var(--color-brand-text)]"
                        >
                          {post.title}
                        </a>
                        {post.featured ? <span className="ml-2 badge-brand text-[10px]">Highlight</span> : null}
                      </td>
                      <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                        {SOCIAL_PLATFORM_META[post.platform].label}
                      </td>
                      <td className="border-b border-[var(--color-line)] px-4 py-3 text-[var(--color-ink-muted)]">
                        {SOCIAL_POST_TYPE_LABEL[post.type]}
                      </td>
                      <td className="border-b border-[var(--color-line)] px-4 py-3 text-xs text-[var(--color-ink-muted)]">
                        {post.postedAt ? formatDate(post.postedAt) : '–'}
                      </td>
                      <td className="border-b border-[var(--color-line)] px-4 py-3">
                        {post.publishedAt ? <span className="badge-success">sichtbar</span> : <span className="badge-neutral">intern</span>}
                      </td>
                      <td className="border-b border-[var(--color-line)] px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <ActionForm action={publishPostAction}>
                            <input type="hidden" name="id" value={post.id} />
                            <SubmitButton variant="secondary" pendingLabel="…">
                              {post.publishedAt ? 'Ausblenden' : 'Anzeigen'}
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={deletePostAction}>
                            <input type="hidden" name="id" value={post.id} />
                            <SubmitButton variant="ghost" pendingLabel="…" confirm={`Beitrag „${post.title}“ löschen?`}>
                              Löschen
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </DataTable>
            </Panel>

            <Panel title="Beitrag erfassen" description="Beiträge werden manuell kuratiert und mit lokalem Vorschaubild dargestellt.">
              <ActionForm action={savePostAction} resetOnSuccess className="space-y-4">
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Plattform" name="post-platform" errorKey="platform" required>
                      <select id="post-platform" name="platform" className="select">
                        {Object.values(SocialPlatform).map((platform) => (
                          <option key={platform} value={platform}>
                            {SOCIAL_PLATFORM_META[platform].label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Art" name="type" required>
                      <select id="type" name="type" className="select">
                        {Object.values(SocialPostType).map((type) => (
                          <option key={type} value={type}>
                            {SOCIAL_POST_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Account" name="accountId">
                      <select id="accountId" name="accountId" className="select">
                        <option value="">Keine Zuordnung</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {SOCIAL_PLATFORM_META[account.platform].label} · {account.handle}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Titel" name="title" required>
                    <input id="title" name="title" type="text" required maxLength={150} className="input" />
                  </Field>

                  <Field label="Adresse des Beitrags" name="url" required>
                    <input id="url" name="url" type="url" required className="input" placeholder="https://…" />
                  </Field>

                  <Field label="Kurztext" name="excerpt">
                    <textarea id="excerpt" name="excerpt" rows={2} maxLength={300} className="input resize-y" />
                  </Field>

                  <MediaSelectField
                    label="Vorschaubild"
                    name="thumbnailId"
                    media={media}
                    hint="Wird lokal ausgeliefert – es werden keine Daten an die Plattform übertragen."
                  />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Veröffentlicht am (Plattform)" name="postedAt">
                      <input id="postedAt" name="postedAt" type="datetime-local" className="input" />
                    </Field>
                    <Field label="Auf Website anzeigen ab" name="scheduledPublishAt">
                      <input id="scheduledPublishAt" name="scheduledPublishAt" type="datetime-local" defaultValue={toLocalInputValue(null)} className="input" />
                    </Field>
                    <Field label="Reihenfolge" name="post-sortOrder" errorKey="sortOrder">
                      <input id="post-sortOrder" name="sortOrder" type="number" defaultValue={0} className="input" />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                    <input type="checkbox" name="featured" className="h-4 w-4 accent-[var(--color-brand)]" />
                    Als Highlight hervorheben
                  </label>

                  <SubmitButton>Beitrag speichern</SubmitButton>
                </>
              </ActionForm>
            </Panel>
          </>
        ) : null}
      </div>
    </>
  );
}
