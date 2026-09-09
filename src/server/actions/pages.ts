'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PageStatus, type Prisma, type SectionType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { SECTION_SCHEMAS, defaultSectionData } from '@/lib/content/sections';
import {
  checkbox,
  dateTime,
  failure,
  optionalText,
  runAction,
  success,
  text,
  type ActionState,
} from '@/server/actions/types';

/**
 * Server Actions des Website-Builders.
 *
 * Trennung von Entwurf und Veröffentlichung:
 *  - `PageSection` enthält den Arbeitsstand (Entwurf).
 *  - `Page.publishedContent` enthält den Stand, den Besucher sehen.
 *  - Beim Veröffentlichen wird der Entwurf als Snapshot übernommen und
 *    zusätzlich als Version archiviert.
 */

const RESERVED_SLUGS = ['turniere', 'partner', 'social', 'kontakt', 'admin', 'api', 'vorschau'];

const slugSchema = z
  .string()
  .min(1, 'Bitte gib eine URL an.')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Die URL darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.');

type PageSnapshot = {
  title: string;
  sections: { id: string; type: SectionType; visible: boolean; data: unknown }[];
};

async function buildSnapshot(pageId: string): Promise<PageSnapshot> {
  const page = await prisma.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { sections: { orderBy: { position: 'asc' } } },
  });

  return {
    title: page.title,
    sections: page.sections.map((section) => ({
      id: section.id,
      type: section.type,
      visible: section.visible,
      data: section.data,
    })),
  };
}

async function nextVersion(pageId: string): Promise<number> {
  const latest = await prisma.pageVersion.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  return (latest?.version ?? 0) + 1;
}

function refreshPage(slug: string): void {
  invalidateTags(CacheTag.pages, CacheTag.page(slug));
  revalidatePath(slug === 'home' ? '/' : `/${slug}`);
  revalidatePath('/sitemap.xml');
}

// ---------------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------------

export async function createPageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);

    const title = text(formData, 'title');
    if (title.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { title: 'Der Titel muss mindestens 2 Zeichen haben.' });
    }

    const rawSlug = text(formData, 'slug') || slugify(title);
    const slugCheck = slugSchema.safeParse(rawSlug);
    if (!slugCheck.success) {
      return failure('Bitte prüfe die markierten Felder.', { slug: slugCheck.error.issues[0]?.message ?? 'Ungültige URL.' });
    }

    if (RESERVED_SLUGS.includes(slugCheck.data)) {
      return failure('Bitte prüfe die markierten Felder.', {
        slug: 'Diese URL ist für einen festen Bereich der Website reserviert.',
      });
    }

    const existing = await prisma.page.findUnique({ where: { slug: slugCheck.data }, select: { id: true } });
    if (existing) {
      return failure('Bitte prüfe die markierten Felder.', { slug: 'Diese URL wird bereits verwendet.' });
    }

    const page = await prisma.page.create({
      data: { title, slug: slugCheck.data, status: PageStatus.DRAFT },
      select: { id: true, slug: true, title: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Page',
      entityId: page.id,
      summary: `Seite „${page.title}“ als Entwurf angelegt.`,
      metadata: { slug: page.slug },
      actor: user,
    });

    return success('Die Seite wurde angelegt.', { id: page.id });
  });

  if (result.status === 'success' && result.data?.id) {
    redirect(`/admin/seiten/${result.data.id}`);
  }
  return result;
}

export async function updatePageMetaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const pageId = text(formData, 'pageId');

    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) return failure('Die Seite wurde nicht gefunden.');

    const title = text(formData, 'title');
    if (title.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { title: 'Der Titel muss mindestens 2 Zeichen haben.' });
    }

    let slug = page.slug;

    // Systemseiten behalten ihren Slug, weil Routen fest damit verknüpft sind.
    if (!page.isSystem) {
      const slugCheck = slugSchema.safeParse(text(formData, 'slug'));
      if (!slugCheck.success) {
        return failure('Bitte prüfe die markierten Felder.', {
          slug: slugCheck.error.issues[0]?.message ?? 'Ungültige URL.',
        });
      }
      if (RESERVED_SLUGS.includes(slugCheck.data)) {
        return failure('Bitte prüfe die markierten Felder.', { slug: 'Diese URL ist reserviert.' });
      }

      const conflict = await prisma.page.findFirst({
        where: { slug: slugCheck.data, id: { not: pageId } },
        select: { id: true },
      });
      if (conflict) {
        return failure('Bitte prüfe die markierten Felder.', { slug: 'Diese URL wird bereits verwendet.' });
      }

      slug = slugCheck.data;
    }

    const scheduledPublishAt = dateTime(formData, 'scheduledPublishAt');
    const scheduledUnpublishAt = dateTime(formData, 'scheduledUnpublishAt');

    if (scheduledPublishAt && scheduledUnpublishAt && scheduledUnpublishAt <= scheduledPublishAt) {
      return failure('Bitte prüfe die markierten Felder.', {
        scheduledUnpublishAt: 'Die Deaktivierung muss nach der Veröffentlichung liegen.',
      });
    }

    await prisma.page.update({
      where: { id: pageId },
      data: {
        title,
        slug,
        seoTitle: optionalText(formData, 'seoTitle'),
        seoDescription: optionalText(formData, 'seoDescription'),
        seoImageId: optionalText(formData, 'seoImageId'),
        seoNoIndex: checkbox(formData, 'seoNoIndex'),
        canonicalUrl: optionalText(formData, 'canonicalUrl'),
        scheduledPublishAt,
        scheduledUnpublishAt,
      },
    });

    // Beim Ändern der URL bleibt die alte Adresse per Weiterleitung erreichbar.
    if (slug !== page.slug) {
      await prisma.redirect.upsert({
        where: { source: `/${page.slug}` },
        create: {
          source: `/${page.slug}`,
          destination: `/${slug}`,
          statusCode: 308,
          note: 'Automatisch beim Ändern der Seiten-URL erstellt.',
        },
        update: { destination: `/${slug}`, active: true },
      });
      invalidateTags(CacheTag.redirects);
      refreshPage(page.slug);
    }

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Page',
      entityId: pageId,
      summary: `Einstellungen der Seite „${title}“ geändert.`,
      metadata: { slug, slugChanged: slug !== page.slug },
      actor: user,
    });

    refreshPage(slug);
    return success('Die Seiteneinstellungen wurden gespeichert.');
  });
}

export async function publishPageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_PUBLISH);
    const pageId = text(formData, 'pageId');

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true, slug: true, title: true } });
    if (!page) return failure('Die Seite wurde nicht gefunden.');

    const snapshot = await buildSnapshot(pageId);
    if (snapshot.sections.length === 0) {
      return failure('Die Seite enthält noch keine Abschnitte und kann daher nicht veröffentlicht werden.');
    }

    const version = await nextVersion(pageId);

    await prisma.$transaction([
      prisma.page.update({
        where: { id: pageId },
        data: {
          status: PageStatus.PUBLISHED,
          publishedContent: snapshot as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
          publishedById: user.id,
          scheduledPublishAt: null,
          archivedAt: null,
        },
      }),
      prisma.pageVersion.create({
        data: {
          pageId,
          version,
          changeType: 'publish',
          label: `Veröffentlichung v${version}`,
          content: snapshot as unknown as Prisma.InputJsonValue,
          createdById: user.id,
        },
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.PUBLISH,
      entityType: 'Page',
      entityId: pageId,
      summary: `Seite „${page.title}“ veröffentlicht (Version ${version}).`,
      metadata: { slug: page.slug, version },
      actor: user,
    });

    refreshPage(page.slug);
    return success(`Die Seite ist jetzt öffentlich sichtbar (Version ${version}).`);
  });
}

export async function unpublishPageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_PUBLISH);
    const pageId = text(formData, 'pageId');

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { slug: true, title: true, isSystem: true } });
    if (!page) return failure('Die Seite wurde nicht gefunden.');

    await prisma.page.update({
      where: { id: pageId },
      data: { status: PageStatus.DRAFT, scheduledUnpublishAt: null },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UNPUBLISH,
      entityType: 'Page',
      entityId: pageId,
      summary: `Seite „${page.title}“ von der Website genommen.`,
      metadata: { slug: page.slug },
      actor: user,
    });

    refreshPage(page.slug);
    return success('Die Seite ist nicht mehr öffentlich sichtbar. Der Entwurf bleibt erhalten.');
  });
}

export async function duplicatePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const pageId = text(formData, 'pageId');

    const source = await prisma.page.findUnique({
      where: { id: pageId },
      include: { sections: { orderBy: { position: 'asc' } } },
    });
    if (!source) return failure('Die Seite wurde nicht gefunden.');

    let slug = `${source.slug}-kopie`;
    let counter = 2;
    while (await prisma.page.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${source.slug}-kopie-${counter}`;
      counter += 1;
    }

    const copy = await prisma.page.create({
      data: {
        title: `${source.title} (Kopie)`,
        slug,
        status: PageStatus.DRAFT,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        seoImageId: source.seoImageId,
        sections: {
          create: source.sections.map((section) => ({
            type: section.type,
            position: section.position,
            visible: section.visible,
            data: section.data as Prisma.InputJsonValue,
          })),
        },
      },
      select: { id: true, title: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.DUPLICATE,
      entityType: 'Page',
      entityId: copy.id,
      summary: `Seite „${source.title}“ dupliziert.`,
      metadata: { sourceId: source.id, slug },
      actor: user,
    });

    return success('Die Seite wurde dupliziert.', { id: copy.id });
  });

  if (result.status === 'success' && result.data?.id) {
    redirect(`/admin/seiten/${result.data.id}`);
  }
  return result;
}

export async function archivePageAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_DELETE);
    const pageId = text(formData, 'pageId');

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      select: { slug: true, title: true, isSystem: true, archivedAt: true },
    });
    if (!page) return failure('Die Seite wurde nicht gefunden.');
    if (page.isSystem) {
      return failure('Systemseiten können nicht archiviert werden, weil feste Bereiche der Website darauf zugreifen.');
    }

    const restoring = page.archivedAt !== null;

    await prisma.page.update({
      where: { id: pageId },
      data: restoring
        ? { archivedAt: null, status: PageStatus.DRAFT }
        : { archivedAt: new Date(), status: PageStatus.ARCHIVED },
    });

    await recordAudit({
      action: restoring ? AUDIT_ACTIONS.RESTORE : AUDIT_ACTIONS.ARCHIVE,
      entityType: 'Page',
      entityId: pageId,
      summary: restoring
        ? `Seite „${page.title}“ aus dem Archiv geholt.`
        : `Seite „${page.title}“ archiviert.`,
      metadata: { slug: page.slug },
      actor: user,
    });

    refreshPage(page.slug);
    return success(restoring ? 'Die Seite wurde wiederhergestellt.' : 'Die Seite wurde archiviert.');
  });
}

// ---------------------------------------------------------------------------
// Abschnitte
// ---------------------------------------------------------------------------

export async function addSectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const pageId = text(formData, 'pageId');
    const type = text(formData, 'type') as SectionType;

    if (!(type in SECTION_SCHEMAS)) {
      return failure('Dieser Abschnittstyp ist nicht verfügbar.');
    }

    const page = await prisma.page.findUnique({ where: { id: pageId }, select: { slug: true, title: true } });
    if (!page) return failure('Die Seite wurde nicht gefunden.');

    const last = await prisma.pageSection.findFirst({
      where: { pageId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const section = await prisma.pageSection.create({
      data: {
        pageId,
        type,
        position: (last?.position ?? -1) + 1,
        data: defaultSectionData(type) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Page',
      entityId: pageId,
      summary: `Abschnitt „${type}“ zur Seite „${page.title}“ hinzugefügt.`,
      metadata: { sectionId: section.id, type },
      actor: user,
    });

    return success('Der Abschnitt wurde hinzugefügt.', { id: section.id });
  });
}

export async function updateSectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const sectionId = text(formData, 'sectionId');
    const payload = text(formData, 'data');

    const section = await prisma.pageSection.findUnique({
      where: { id: sectionId },
      select: { id: true, type: true, pageId: true, page: { select: { title: true } } },
    });
    if (!section) return failure('Der Abschnitt wurde nicht gefunden.');

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return failure('Die Eingaben konnten nicht gelesen werden. Bitte lade die Seite neu.');
    }

    const schema = SECTION_SCHEMAS[section.type];
    const validated = schema.safeParse(parsedPayload);

    if (!validated.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validated.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return failure('Bitte prüfe die markierten Felder.', fieldErrors);
    }

    await prisma.pageSection.update({
      where: { id: sectionId },
      data: {
        data: validated.data as unknown as Prisma.InputJsonValue,
        visible: checkbox(formData, 'visible'),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'PageSection',
      entityId: sectionId,
      summary: `Abschnitt „${section.type}“ auf Seite „${section.page.title}“ bearbeitet.`,
      metadata: { pageId: section.pageId },
      actor: user,
    });

    return success('Der Abschnitt wurde gespeichert. Veröffentliche die Seite, damit die Änderung sichtbar wird.');
  });
}

export async function deleteSectionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const sectionId = text(formData, 'sectionId');

    const section = await prisma.pageSection.findUnique({
      where: { id: sectionId },
      select: { pageId: true, type: true, page: { select: { title: true } } },
    });
    if (!section) return failure('Der Abschnitt wurde nicht gefunden.');

    await prisma.pageSection.delete({ where: { id: sectionId } });
    await renumberSections(section.pageId);

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Page',
      entityId: section.pageId,
      summary: `Abschnitt „${section.type}“ von Seite „${section.page.title}“ entfernt.`,
      actor: user,
    });

    return success('Der Abschnitt wurde entfernt.');
  });
}

export async function reorderSectionsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const pageId = text(formData, 'pageId');
    const order = text(formData, 'order')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (order.length === 0) return failure('Es wurde keine Reihenfolge übermittelt.');

    const sections = await prisma.pageSection.findMany({ where: { pageId }, select: { id: true } });
    const known = new Set(sections.map((section) => section.id));

    if (order.length !== known.size || order.some((id) => !known.has(id))) {
      return failure('Die Reihenfolge passt nicht mehr zum aktuellen Stand. Bitte lade die Seite neu.');
    }

    await prisma.$transaction(
      order.map((id, index) => prisma.pageSection.update({ where: { id }, data: { position: index } })),
    );

    return success('Die Reihenfolge wurde gespeichert.');
  });
}

async function renumberSections(pageId: string): Promise<void> {
  const sections = await prisma.pageSection.findMany({
    where: { pageId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  await prisma.$transaction(
    sections.map((section, index) => prisma.pageSection.update({ where: { id: section.id }, data: { position: index } })),
  );
}

// ---------------------------------------------------------------------------
// Versionen
// ---------------------------------------------------------------------------

export async function restoreVersionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.PAGES_EDIT);
    const versionId = text(formData, 'versionId');

    const version = await prisma.pageVersion.findUnique({
      where: { id: versionId },
      include: { page: { select: { id: true, slug: true, title: true } } },
    });
    if (!version) return failure('Die Version wurde nicht gefunden.');

    const content = version.content as unknown as PageSnapshot;
    if (!Array.isArray(content.sections)) {
      return failure('Diese Version enthält keine gültigen Inhalte.');
    }

    // Der wiederhergestellte Stand landet zunächst im Entwurf – veröffentlicht
    // wird bewusst in einem separaten Schritt.
    await prisma.$transaction([
      prisma.pageSection.deleteMany({ where: { pageId: version.page.id } }),
      prisma.page.update({
        where: { id: version.page.id },
        data: {
          title: content.title ?? version.page.title,
          sections: {
            create: content.sections.map((section, index) => ({
              type: section.type,
              position: index,
              visible: section.visible !== false,
              data: section.data as Prisma.InputJsonValue,
            })),
          },
        },
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.RESTORE,
      entityType: 'Page',
      entityId: version.page.id,
      summary: `Version ${version.version} der Seite „${version.page.title}“ als Entwurf wiederhergestellt.`,
      metadata: { versionId, version: version.version },
      actor: user,
    });

    return success(
      `Version ${version.version} wurde als Entwurf wiederhergestellt. Prüfe die Vorschau und veröffentliche anschliessend.`,
    );
  });
}
