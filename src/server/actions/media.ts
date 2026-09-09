'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { invalidateAll } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { MediaValidationError, deleteStoredFile, storeUpload } from '@/lib/media';
import { mediaUsage } from '@/lib/mediaUsage';
import { failure, optionalText, runAction, success, text, type ActionState } from '@/server/actions/types';

/** Medienbibliothek: Upload, Pflege der Metadaten, Ersetzen und Löschen. */

export async function uploadMediaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.MEDIA_MANAGE);

    const limit = await consumeRateLimit(RATE_LIMITS.mediaUpload, user.id);
    if (!limit.allowed) {
      return failure('Es wurden zu viele Dateien in kurzer Zeit hochgeladen. Bitte warte einen Moment.');
    }

    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) {
      return failure('Bitte wähle mindestens eine Datei aus.');
    }
    if (files.length > 10) {
      return failure('Bitte lade höchstens 10 Dateien gleichzeitig hoch.');
    }

    const uploaded: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await storeUpload(buffer);

        // Identische Dateien werden nicht doppelt abgelegt.
        const duplicate = await prisma.mediaAsset.findFirst({
          where: { checksum: stored.checksum },
          select: { id: true, originalName: true },
        });

        if (duplicate) {
          await deleteStoredFile(stored.storageKey);
          errors.push(`„${file.name}“ ist bereits als „${duplicate.originalName}“ vorhanden.`);
          continue;
        }

        const asset = await prisma.mediaAsset.create({
          data: {
            kind: stored.kind,
            storageKey: stored.storageKey,
            originalName: file.name.slice(0, 200),
            mimeType: stored.mimeType,
            byteSize: stored.byteSize,
            width: stored.width,
            height: stored.height,
            checksum: stored.checksum,
            uploadedById: user.id,
          },
          select: { id: true },
        });

        uploaded.push(asset.id);
      } catch (error) {
        errors.push(
          error instanceof MediaValidationError
            ? `„${file.name}“: ${error.message}`
            : `„${file.name}“ konnte nicht verarbeitet werden.`,
        );
      }
    }

    if (uploaded.length > 0) {
      await recordAudit({
        action: AUDIT_ACTIONS.MEDIA_UPLOAD,
        entityType: 'MediaAsset',
        summary: `${uploaded.length} Datei(en) hochgeladen.`,
        metadata: { ids: uploaded },
        actor: user,
      });
      revalidatePath('/admin/medien');
    }

    if (uploaded.length === 0) {
      return failure(errors.join(' ') || 'Es konnte keine Datei verarbeitet werden.');
    }

    return success(
      errors.length > 0
        ? `${uploaded.length} Datei(en) hochgeladen. Hinweise: ${errors.join(' ')}`
        : `${uploaded.length} Datei(en) hochgeladen.`,
    );
  });
}

export async function updateMediaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.MEDIA_MANAGE);
    const id = text(formData, 'id');

    const asset = await prisma.mediaAsset.findUnique({ where: { id }, select: { originalName: true } });
    if (!asset) return failure('Das Medium wurde nicht gefunden.');

    await prisma.mediaAsset.update({
      where: { id },
      data: {
        alt: optionalText(formData, 'alt'),
        title: optionalText(formData, 'title'),
        description: optionalText(formData, 'description'),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'MediaAsset',
      entityId: id,
      summary: `Angaben zu „${asset.originalName}“ bearbeitet.`,
      actor: user,
    });

    // Alt-Texte erscheinen direkt auf der Website.
    invalidateAll();
    revalidatePath('/admin/medien');
    return success('Die Angaben wurden gespeichert.');
  });
}

export async function deleteMediaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.MEDIA_MANAGE);
    const id = text(formData, 'id');

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { originalName: true, storageKey: true },
    });
    if (!asset) return failure('Das Medium wurde nicht gefunden.');

    const usage = await mediaUsage(id);
    // Verwendete Blöcke referenzieren die ID; ein Löschen würde sie leeren.
    // Das ist zulässig, muss aber ausdrücklich bestätigt werden.
    if (usage.length > 0 && text(formData, 'confirmUsed') !== 'ja') {
      return failure(
        `Dieses Medium wird noch verwendet: ${usage.map((entry) => `${entry.label} (${entry.count})`).join(', ')}. Bestätige das Löschen, wenn du sicher bist.`,
      );
    }

    await prisma.mediaAsset.delete({ where: { id } });
    await deleteStoredFile(asset.storageKey);

    await recordAudit({
      action: AUDIT_ACTIONS.MEDIA_DELETE,
      entityType: 'MediaAsset',
      entityId: id,
      summary: `Medium „${asset.originalName}“ gelöscht.`,
      metadata: { usage },
      actor: user,
    });

    invalidateAll();
    revalidatePath('/admin/medien');
    return success('Das Medium wurde gelöscht.');
  });
}

/**
 * Ersetzt die Datei eines bestehenden Mediums. Die ID bleibt erhalten, sodass
 * alle Verwendungen automatisch die neue Datei zeigen.
 */
export async function replaceMediaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.MEDIA_MANAGE);
    const id = text(formData, 'id');
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return failure('Bitte wähle eine Datei aus.');
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { originalName: true, storageKey: true, kind: true },
    });
    if (!asset) return failure('Das Medium wurde nicht gefunden.');

    try {
      const stored = await storeUpload(Buffer.from(await file.arrayBuffer()));

      if (stored.kind !== asset.kind) {
        await deleteStoredFile(stored.storageKey);
        return failure('Die neue Datei muss vom selben Typ sein wie die bisherige.');
      }

      const previousKey = asset.storageKey;

      await prisma.mediaAsset.update({
        where: { id },
        data: {
          storageKey: stored.storageKey,
          mimeType: stored.mimeType,
          byteSize: stored.byteSize,
          width: stored.width,
          height: stored.height,
          checksum: stored.checksum,
          originalName: file.name.slice(0, 200),
        },
      });

      await deleteStoredFile(previousKey);

      await recordAudit({
        action: AUDIT_ACTIONS.MEDIA_REPLACE,
        entityType: 'MediaAsset',
        entityId: id,
        summary: `Datei von „${asset.originalName}“ durch „${file.name}“ ersetzt.`,
        actor: user,
      });

      invalidateAll();
      revalidatePath('/admin/medien');
      return success('Die Datei wurde ersetzt. Alle Verwendungen zeigen jetzt die neue Datei.');
    } catch (error) {
      return failure(
        error instanceof MediaValidationError ? error.message : 'Die Datei konnte nicht verarbeitet werden.',
      );
    }
  });
}
