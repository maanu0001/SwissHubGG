import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MediaKind, PageStatus } from '@prisma/client';
import { PageHeader, Panel, Field, InfoBox } from '@/components/admin/ui';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { PageBuilder, type BuilderSection } from '@/components/admin/builder/PageBuilder';
import { LinkCheck } from '@/components/admin/builder/LinkCheck';
import {
  archivePageAction,
  duplicatePageAction,
  publishPageAction,
  unpublishPageAction,
  updatePageMetaAction,
} from '@/server/actions/pages';
import { requirePermission } from '@/lib/auth/guards';
import { userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { toLocalInputValue } from '@/server/actions/types';

/** Website-Builder einer einzelnen Seite inklusive Einstellungen und Veröffentlichung. */

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id }, select: { title: true } });
  return { title: page ? `${page.title} bearbeiten` : 'Seite' };
}

export default async function PageBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requirePermission(PERMISSIONS.PAGES_VIEW);

  const canEdit = userHasPermission(user, PERMISSIONS.PAGES_EDIT);
  const canPublish = userHasPermission(user, PERMISSIONS.PAGES_PUBLISH);
  const canDelete = userHasPermission(user, PERMISSIONS.PAGES_DELETE);

  const page = await prisma.page.findUnique({
    where: { id },
    include: { sections: { orderBy: { position: 'asc' } } },
  });

  if (!page) {
    notFound();
  }

  const [media, sponsors, versionCount] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { kind: { in: [MediaKind.IMAGE, MediaKind.DOCUMENT] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        storageKey: true,
        originalName: true,
        alt: true,
        title: true,
        kind: true,
        width: true,
        height: true,
      },
    }),
    prisma.sponsor.findMany({
      where: { archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.pageVersion.count({ where: { pageId: id } }),
  ]);

  const sections: BuilderSection[] = page.sections.map((section) => ({
    id: section.id,
    type: section.type,
    visible: section.visible,
    data: (section.data ?? {}) as Record<string, unknown>,
  }));

  const publicPath = page.slug === 'home' ? '/' : `/${page.slug}`;
  const hasUnpublishedChanges =
    page.status === PageStatus.PUBLISHED && page.publishedAt !== null && page.updatedAt > page.publishedAt;

  return (
    <>
      <PageHeader
        title={page.title}
        description={`Öffentliche Adresse: ${publicPath}`}
        breadcrumb={[{ label: 'Seiten', href: '/admin/seiten' }]}
        actions={
          <>
            <Link href={`/vorschau/${page.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Vorschau
            </Link>
            <Link href={`/admin/seiten/${page.id}/versionen`} className="btn-secondary">
              Versionen ({versionCount})
            </Link>
          </>
        }
      />

      <div className="mb-6 space-y-4">
        {page.status === PageStatus.PUBLISHED ? (
          hasUnpublishedChanges ? (
            <InfoBox tone="warning" title="Es gibt nicht veröffentlichte Änderungen">
              Der Entwurf unterscheidet sich vom öffentlichen Stand. Prüfe die Vorschau und veröffentliche
              anschliessend, damit die Änderungen sichtbar werden.
            </InfoBox>
          ) : (
            <InfoBox tone="success" title="Die Seite ist öffentlich sichtbar">
              Zuletzt veröffentlicht am {formatDateTime(page.publishedAt)}.
            </InfoBox>
          )
        ) : page.status === PageStatus.ARCHIVED ? (
          <InfoBox tone="warning" title="Diese Seite ist archiviert">
            Archivierte Seiten sind öffentlich nicht erreichbar.
          </InfoBox>
        ) : (
          <InfoBox tone="info" title="Diese Seite ist ein Entwurf">
            Sie ist öffentlich nicht erreichbar. Über die Vorschau kannst du sie als angemeldete Person ansehen.
          </InfoBox>
        )}

        {canPublish ? (
          <div className="flex flex-wrap gap-3">
            <ActionForm action={publishPageAction}>
              <input type="hidden" name="pageId" value={page.id} />
              <SubmitButton pendingLabel="Wird veröffentlicht …">
                {page.status === PageStatus.PUBLISHED ? 'Änderungen veröffentlichen' : 'Seite veröffentlichen'}
              </SubmitButton>
            </ActionForm>

            {page.status === PageStatus.PUBLISHED ? (
              <ActionForm action={unpublishPageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <SubmitButton
                  variant="secondary"
                  pendingLabel="Wird zurückgezogen …"
                  confirm="Die Seite ist danach öffentlich nicht mehr erreichbar. Fortfahren?"
                >
                  Von der Website nehmen
                </SubmitButton>
              </ActionForm>
            ) : null}

            {canEdit ? (
              <ActionForm action={duplicatePageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <SubmitButton variant="secondary" pendingLabel="Wird dupliziert …">
                  Duplizieren
                </SubmitButton>
              </ActionForm>
            ) : null}

            {canDelete && !page.isSystem ? (
              <ActionForm action={archivePageAction}>
                <input type="hidden" name="pageId" value={page.id} />
                <SubmitButton
                  variant="danger"
                  pendingLabel="Wird ausgeführt …"
                  confirm={
                    page.archivedAt
                      ? 'Seite wiederherstellen?'
                      : 'Seite archivieren? Sie ist danach öffentlich nicht mehr erreichbar.'
                  }
                >
                  {page.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
                </SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        ) : null}
      </div>

      <PageBuilder
        pageId={page.id}
        initialSections={sections}
        media={media}
        sponsors={sponsors}
        canEdit={canEdit}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Seiteneinstellungen" description="Titel, URL, Terminierung und SEO-Angaben.">
          <ActionForm action={updatePageMetaAction} className="space-y-4">
            <>
              <input type="hidden" name="pageId" value={page.id} />

              <Field label="Titel" name="title" required>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={120}
                  defaultValue={page.title}
                  disabled={!canEdit}
                  className="input"
                />
              </Field>

              <Field
                label="URL"
                name="slug"
                hint={
                  page.isSystem
                    ? 'Die URL dieser Systemseite ist fest mit der Anwendung verknüpft und kann nicht geändert werden.'
                    : 'Beim Ändern wird automatisch eine Weiterleitung von der alten Adresse angelegt.'
                }
              >
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  maxLength={80}
                  defaultValue={page.slug}
                  disabled={!canEdit || page.isSystem}
                  className="input font-mono text-sm"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Veröffentlichen am"
                  name="scheduledPublishAt"
                  hint="Optional. Zeitzone Europe/Zurich."
                >
                  <input
                    id="scheduledPublishAt"
                    name="scheduledPublishAt"
                    type="datetime-local"
                    defaultValue={toLocalInputValue(page.scheduledPublishAt)}
                    disabled={!canEdit}
                    className="input"
                  />
                </Field>

                <Field
                  label="Deaktivieren am"
                  name="scheduledUnpublishAt"
                  hint="Optional."
                >
                  <input
                    id="scheduledUnpublishAt"
                    name="scheduledUnpublishAt"
                    type="datetime-local"
                    defaultValue={toLocalInputValue(page.scheduledUnpublishAt)}
                    disabled={!canEdit}
                    className="input"
                  />
                </Field>
              </div>

              <Field
                label="SEO-Titel"
                name="seoTitle"
                hint="Empfohlen: 50–60 Zeichen. Leer lassen, um den Seitentitel zu verwenden."
              >
                <input
                  id="seoTitle"
                  name="seoTitle"
                  type="text"
                  maxLength={70}
                  defaultValue={page.seoTitle ?? ''}
                  disabled={!canEdit}
                  className="input"
                />
              </Field>

              <Field
                label="SEO-Beschreibung"
                name="seoDescription"
                hint="Empfohlen: 120–160 Zeichen."
              >
                <textarea
                  id="seoDescription"
                  name="seoDescription"
                  rows={3}
                  maxLength={200}
                  defaultValue={page.seoDescription ?? ''}
                  disabled={!canEdit}
                  className="input resize-y"
                />
              </Field>

              <Field label="Canonical-URL" name="canonicalUrl" hint="Nur setzen, wenn eine andere Adresse massgeblich ist.">
                <input
                  id="canonicalUrl"
                  name="canonicalUrl"
                  type="url"
                  defaultValue={page.canonicalUrl ?? ''}
                  disabled={!canEdit}
                  className="input"
                />
              </Field>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="seoNoIndex"
                  defaultChecked={page.seoNoIndex}
                  disabled={!canEdit}
                  className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
                />
                <span className="text-sm text-[var(--color-ink-muted)]">
                  Von Suchmaschinen ausschliessen (noindex)
                </span>
              </label>

              {canEdit ? <SubmitButton>Einstellungen speichern</SubmitButton> : null}
            </>
          </ActionForm>
        </Panel>

        <LinkCheck pageId={page.id} />
      </div>
    </>
  );
}
