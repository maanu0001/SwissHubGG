'use server';

import { revalidatePath } from 'next/cache';
import { SocialPlatform, SocialPostType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
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

/**
 * Verwaltung der Social-Media-Accounts und der kuratierten Beiträge.
 *
 * Es gibt bewusst keine automatische Veröffentlichung auf Plattformen: Dafür
 * wären offizielle APIs und Zugangsdaten nötig. Das Datenmodell ist auf eine
 * spätere Anbindung vorbereitet (`lastSyncedAt`, `lastSyncError`), ohne dass
 * jetzt Hintergrundabfragen entstehen.
 */

const platformValues = Object.values(SocialPlatform) as [SocialPlatform, ...SocialPlatform[]];
const postTypeValues = Object.values(SocialPostType) as [SocialPostType, ...SocialPostType[]];

function refresh(): void {
  invalidateTags(CacheTag.social);
  revalidatePath('/social');
  revalidatePath('/');
}

export async function saveAccountAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE);

    const platform = z.enum(platformValues).safeParse(text(formData, 'platform'));
    if (!platform.success) {
      return failure('Bitte prüfe die markierten Felder.', { platform: 'Bitte wähle eine Plattform.' });
    }

    const handle = text(formData, 'handle');
    if (handle.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { handle: 'Bitte gib den Benutzernamen an.' });
    }

    const profileUrl = text(formData, 'profileUrl');
    if (!safeUrl(profileUrl) || !profileUrl.startsWith('http')) {
      return failure('Bitte prüfe die markierten Felder.', {
        profileUrl: 'Bitte gib die vollständige Profiladresse an (https://…).',
      });
    }

    const existingId = optionalText(formData, 'id');
    const conflict = await prisma.socialAccount.findFirst({
      where: { platform: platform.data, handle, ...(existingId ? { id: { not: existingId } } : {}) },
      select: { id: true },
    });
    if (conflict) {
      return failure('Bitte prüfe die markierten Felder.', { handle: 'Dieser Account ist bereits erfasst.' });
    }

    const followerCount = integer(formData, 'followerCount');

    const data = {
      platform: platform.data,
      handle,
      profileUrl,
      displayName: optionalText(formData, 'displayName'),
      description: optionalText(formData, 'description'),
      active: checkbox(formData, 'active'),
      followerCount,
      followerCountUpdatedAt: followerCount === null ? null : new Date(),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
    };

    if (existingId) {
      await prisma.socialAccount.update({ where: { id: existingId }, data });
    } else {
      await prisma.socialAccount.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'SocialAccount',
      entityId: existingId ?? undefined,
      summary: `Social-Account ${platform.data} „${handle}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    refresh();
    return success('Der Account wurde gespeichert.');
  });
}

export async function deleteAccountAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SOCIAL_ACCOUNTS_MANAGE);
    const id = text(formData, 'id');

    const account = await prisma.socialAccount.findUnique({
      where: { id },
      select: { platform: true, handle: true, _count: { select: { posts: true } } },
    });
    if (!account) return failure('Der Account wurde nicht gefunden.');

    await prisma.socialAccount.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'SocialAccount',
      entityId: id,
      summary: `Social-Account ${account.platform} „${account.handle}“ gelöscht.`,
      metadata: { linkedPosts: account._count.posts },
      actor: user,
    });

    refresh();
    return success(
      account._count.posts > 0
        ? `Der Account wurde gelöscht. ${account._count.posts} Beitrag/Beiträge bleiben erhalten, sind aber keinem Account mehr zugeordnet.`
        : 'Der Account wurde gelöscht.',
    );
  });
}

export async function savePostAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SOCIAL_POSTS_MANAGE);

    const platform = z.enum(platformValues).safeParse(text(formData, 'platform'));
    if (!platform.success) {
      return failure('Bitte prüfe die markierten Felder.', { platform: 'Bitte wähle eine Plattform.' });
    }

    const type = z.enum(postTypeValues).safeParse(text(formData, 'type'));
    if (!type.success) {
      return failure('Bitte prüfe die markierten Felder.', { type: 'Bitte wähle eine Beitragsart.' });
    }

    const title = text(formData, 'title');
    if (title.length < 3) {
      return failure('Bitte prüfe die markierten Felder.', { title: 'Bitte gib einen Titel an.' });
    }

    const url = text(formData, 'url');
    if (!safeUrl(url) || !url.startsWith('http')) {
      return failure('Bitte prüfe die markierten Felder.', { url: 'Bitte gib die vollständige Beitragsadresse an.' });
    }

    const existingId = optionalText(formData, 'id');

    const data = {
      platform: platform.data,
      type: type.data,
      title,
      url,
      accountId: optionalText(formData, 'accountId'),
      excerpt: optionalText(formData, 'excerpt'),
      thumbnailId: optionalText(formData, 'thumbnailId'),
      postedAt: dateTime(formData, 'postedAt'),
      featured: checkbox(formData, 'featured'),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
      scheduledPublishAt: dateTime(formData, 'scheduledPublishAt'),
    };

    if (existingId) {
      await prisma.socialPost.update({ where: { id: existingId }, data });
    } else {
      await prisma.socialPost.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'SocialPost',
      entityId: existingId ?? undefined,
      summary: `Social-Beitrag „${title}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    refresh();
    return success('Der Beitrag wurde gespeichert.');
  });
}

export async function publishPostAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SOCIAL_POSTS_MANAGE);
    const id = text(formData, 'id');

    const post = await prisma.socialPost.findUnique({ where: { id }, select: { title: true, publishedAt: true } });
    if (!post) return failure('Der Beitrag wurde nicht gefunden.');

    const publishing = post.publishedAt === null;

    await prisma.socialPost.update({
      where: { id },
      data: publishing ? { publishedAt: new Date(), scheduledPublishAt: null, archivedAt: null } : { publishedAt: null },
    });

    await recordAudit({
      action: publishing ? AUDIT_ACTIONS.PUBLISH : AUDIT_ACTIONS.UNPUBLISH,
      entityType: 'SocialPost',
      entityId: id,
      summary: publishing ? `Social-Beitrag „${post.title}“ veröffentlicht.` : `Social-Beitrag „${post.title}“ zurückgezogen.`,
      actor: user,
    });

    refresh();
    return success(publishing ? 'Der Beitrag ist jetzt sichtbar.' : 'Der Beitrag ist nicht mehr sichtbar.');
  });
}

export async function deletePostAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.SOCIAL_POSTS_MANAGE);
    const id = text(formData, 'id');

    const post = await prisma.socialPost.findUnique({ where: { id }, select: { title: true } });
    if (!post) return failure('Der Beitrag wurde nicht gefunden.');

    await prisma.socialPost.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'SocialPost',
      entityId: id,
      summary: `Social-Beitrag „${post.title}“ gelöscht.`,
      actor: user,
    });

    refresh();
    return success('Der Beitrag wurde gelöscht.');
  });
}
