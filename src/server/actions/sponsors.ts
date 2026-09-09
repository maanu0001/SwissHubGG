'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { SponsorStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { safeUrl } from '@/lib/sanitize';
import {
  checkbox,
  dateTime,
  failure,
  integer,
  optionalText,
  runAction,
  success,
  text,
  type ActionState,
} from '@/server/actions/types';

/** Verwaltung von Sponsoren, Partnern und Sponsoring-Stufen. */

function refresh(): void {
  invalidateTags(CacheTag.sponsors);
  revalidatePath('/partner');
  revalidatePath('/');
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.sponsor.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

export async function createSponsorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
    const name = text(formData, 'name');

    if (name.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' });
    }

    const slug = await uniqueSlug(slugify(name));

    const sponsor = await prisma.sponsor.create({
      data: { name, slug, status: SponsorStatus.ACTIVE },
      select: { id: true, name: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Sponsor',
      entityId: sponsor.id,
      summary: `Sponsor „${sponsor.name}“ angelegt.`,
      actor: user,
    });

    refresh();
    return success('Der Sponsor wurde angelegt.', { id: sponsor.id });
  });

  if (result.status === 'success' && result.data?.id) {
    redirect(`/admin/sponsoren/${result.data.id}`);
  }
  return result;
}

export async function updateSponsorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
    const id = text(formData, 'id');

    const existing = await prisma.sponsor.findUnique({ where: { id }, select: { slug: true } });
    if (!existing) return failure('Der Sponsor wurde nicht gefunden.');

    const name = text(formData, 'name');
    if (name.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' });
    }

    const websiteUrl = optionalText(formData, 'websiteUrl');
    if (websiteUrl && !safeUrl(websiteUrl)) {
      return failure('Bitte prüfe die markierten Felder.', {
        websiteUrl: 'Bitte gib eine gültige Adresse an (https://…).',
      });
    }

    const partnerSince = dateTime(formData, 'partnerSince');
    const partnerUntil = dateTime(formData, 'partnerUntil');
    if (partnerSince && partnerUntil && partnerUntil < partnerSince) {
      return failure('Bitte prüfe die markierten Felder.', {
        partnerUntil: 'Das Ende der Partnerschaft muss nach dem Beginn liegen.',
      });
    }

    const slug = await uniqueSlug(slugify(text(formData, 'slug') || name), id);

    await prisma.sponsor.update({
      where: { id },
      data: {
        name,
        slug,
        status: text(formData, 'status') === 'FORMER' ? SponsorStatus.FORMER : SponsorStatus.ACTIVE,
        shortDescription: optionalText(formData, 'shortDescription'),
        description: optionalText(formData, 'description'),
        websiteUrl,
        logoId: optionalText(formData, 'logoId'),
        tierId: optionalText(formData, 'tierId'),
        partnerSince,
        partnerUntil,
        featured: checkbox(formData, 'featured'),
        sortOrder: integer(formData, 'sortOrder') ?? 0,
        scheduledPublishAt: dateTime(formData, 'scheduledPublishAt'),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Sponsor',
      entityId: id,
      summary: `Sponsor „${name}“ bearbeitet.`,
      actor: user,
    });

    refresh();
    return success('Der Sponsor wurde gespeichert.');
  });
}

export async function publishSponsorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
    const id = text(formData, 'id');

    const sponsor = await prisma.sponsor.findUnique({ where: { id }, select: { name: true, publishedAt: true } });
    if (!sponsor) return failure('Der Sponsor wurde nicht gefunden.');

    const publishing = sponsor.publishedAt === null;

    await prisma.sponsor.update({
      where: { id },
      data: publishing ? { publishedAt: new Date(), scheduledPublishAt: null, archivedAt: null } : { publishedAt: null },
    });

    await recordAudit({
      action: publishing ? AUDIT_ACTIONS.PUBLISH : AUDIT_ACTIONS.UNPUBLISH,
      entityType: 'Sponsor',
      entityId: id,
      summary: publishing ? `Sponsor „${sponsor.name}“ veröffentlicht.` : `Sponsor „${sponsor.name}“ zurückgezogen.`,
      actor: user,
    });

    refresh();
    return success(publishing ? 'Der Sponsor ist jetzt öffentlich sichtbar.' : 'Der Sponsor ist nicht mehr sichtbar.');
  });
}

export async function archiveSponsorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
    const id = text(formData, 'id');

    const sponsor = await prisma.sponsor.findUnique({ where: { id }, select: { name: true, archivedAt: true } });
    if (!sponsor) return failure('Der Sponsor wurde nicht gefunden.');

    const restoring = sponsor.archivedAt !== null;

    await prisma.sponsor.update({
      where: { id },
      data: restoring ? { archivedAt: null } : { archivedAt: new Date(), publishedAt: null },
    });

    await recordAudit({
      action: restoring ? AUDIT_ACTIONS.RESTORE : AUDIT_ACTIONS.ARCHIVE,
      entityType: 'Sponsor',
      entityId: id,
      summary: restoring ? `Sponsor „${sponsor.name}“ wiederhergestellt.` : `Sponsor „${sponsor.name}“ archiviert.`,
      actor: user,
    });

    refresh();
    return success(restoring ? 'Der Sponsor wurde wiederhergestellt.' : 'Der Sponsor wurde archiviert.');
  });
}

export async function saveSponsorTierAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SPONSORS_MANAGE);
    const name = text(formData, 'name');

    if (name.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' });
    }

    const key = slugify(text(formData, 'key') || name);
    const existingId = optionalText(formData, 'id');

    const conflict = await prisma.sponsorTier.findFirst({
      where: { key, ...(existingId ? { id: { not: existingId } } : {}) },
      select: { id: true },
    });
    if (conflict) {
      return failure('Bitte prüfe die markierten Felder.', { key: 'Dieser Schlüssel wird bereits verwendet.' });
    }

    const data = {
      key,
      name,
      description: optionalText(formData, 'description'),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
    };

    if (existingId) {
      await prisma.sponsorTier.update({ where: { id: existingId }, data });
    } else {
      await prisma.sponsorTier.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'SponsorTier',
      entityId: existingId ?? undefined,
      summary: `Sponsoring-Stufe „${name}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    refresh();
    return success('Die Sponsoring-Stufe wurde gespeichert.');
  });
}
