'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
import { checkbox, failure, integer, optionalText, runAction, success, text, type ActionState } from '@/server/actions/types';

/**
 * Verwaltung der Spiele, nach denen Turniere eingeordnet und gefiltert werden.
 *
 * Die Adresse eines Spiels (`slug`) steckt in den öffentlichen Filterlinks.
 * Sie wird beim Anlegen aus dem Namen abgeleitet und danach nicht mehr
 * verändert – ein späterer Namenswechsel würde sonst bestehende Links
 * entwerten.
 *
 * Gelöscht wird nur, was nirgends verwendet wird. Ein Spiel mit zugeordneten
 * Turnieren wird stattdessen deaktiviert: Es verschwindet aus den öffentlichen
 * Filtern und aus der Auswahl neuer Turniere, die bestehenden Zuordnungen
 * bleiben unangetastet.
 */

function refresh(): void {
  invalidateTags(CacheTag.tournaments);
  revalidatePath('/turniere');
  revalidatePath('/admin/turniere/spiele');
}

async function uniqueSlug(base: string): Promise<string> {
  const start = base.length > 0 ? base : 'spiel';
  let candidate = start;
  let counter = 2;

  for (;;) {
    const existing = await prisma.tournamentGame.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${start}-${counter}`;
    counter += 1;
  }
}

/** Gemeinsame Prüfung der Eingabefelder. */
function readFields(formData: FormData):
  | { ok: true; name: string; shortName: string | null; description: string | null; sortOrder: number; active: boolean }
  | { ok: false; state: ActionState } {
  const name = text(formData, 'name');

  if (name.length < 2) {
    return { ok: false, state: failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' }) };
  }
  if (name.length > 80) {
    return {
      ok: false,
      state: failure('Bitte prüfe die markierten Felder.', { name: 'Bitte kürze den Namen auf höchstens 80 Zeichen.' }),
    };
  }

  const shortName = optionalText(formData, 'shortName');
  if (shortName && shortName.length > 20) {
    return {
      ok: false,
      state: failure('Bitte prüfe die markierten Felder.', {
        shortName: 'Die Kurzform darf höchstens 20 Zeichen lang sein.',
      }),
    };
  }

  const description = optionalText(formData, 'description');
  if (description && description.length > 300) {
    return {
      ok: false,
      state: failure('Bitte prüfe die markierten Felder.', {
        description: 'Bitte kürze die Beschreibung auf höchstens 300 Zeichen.',
      }),
    };
  }

  return {
    ok: true,
    name,
    shortName,
    description,
    sortOrder: integer(formData, 'sortOrder') ?? 0,
    active: checkbox(formData, 'active'),
  };
}

export async function createGameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);

    const fields = readFields(formData);
    if (!fields.ok) return fields.state;

    const game = await prisma.tournamentGame.create({
      data: {
        name: fields.name,
        slug: await uniqueSlug(slugify(fields.name)),
        shortName: fields.shortName,
        description: fields.description,
        sortOrder: fields.sortOrder,
        active: fields.active,
      },
      select: { id: true, name: true, slug: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'TournamentGame',
      entityId: game.id,
      summary: `Spiel „${game.name}“ angelegt.`,
      metadata: { slug: game.slug },
      actor: user,
    });

    refresh();
    return success('Das Spiel wurde angelegt.');
  });
}

export async function updateGameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const id = text(formData, 'id');

    const existing = await prisma.tournamentGame.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) return failure('Das Spiel wurde nicht gefunden.');

    const fields = readFields(formData);
    if (!fields.ok) return fields.state;

    await prisma.tournamentGame.update({
      where: { id },
      // Der Slug bleibt bewusst unverändert: Er steckt in öffentlichen Filterlinks.
      data: {
        name: fields.name,
        shortName: fields.shortName,
        description: fields.description,
        sortOrder: fields.sortOrder,
        active: fields.active,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'TournamentGame',
      entityId: id,
      summary: `Spiel „${fields.name}“ bearbeitet.`,
      metadata: { active: fields.active },
      actor: user,
    });

    refresh();
    return success('Das Spiel wurde gespeichert.');
  });
}

/** Schaltet ein Spiel für neue Zuordnungen und die öffentlichen Filter ab oder frei. */
export async function toggleGameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const id = text(formData, 'id');

    const game = await prisma.tournamentGame.findUnique({ where: { id }, select: { name: true, active: true } });
    if (!game) return failure('Das Spiel wurde nicht gefunden.');

    await prisma.tournamentGame.update({ where: { id }, data: { active: !game.active } });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'TournamentGame',
      entityId: id,
      summary: `Spiel „${game.name}“ ${game.active ? 'deaktiviert' : 'aktiviert'}.`,
      actor: user,
    });

    refresh();
    return success(`„${game.name}“ ist jetzt ${game.active ? 'deaktiviert' : 'aktiv'}.`);
  });
}

/**
 * Löschen ist nur für ein Spiel ohne Turniere zulässig.
 *
 * Damit kann eine Fehleingabe entfernt werden, ohne dass je eine bestehende
 * Zuordnung verloren geht.
 */
export async function deleteGameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const id = text(formData, 'id');

    const game = await prisma.tournamentGame.findUnique({
      where: { id },
      select: { name: true, _count: { select: { tournaments: true } } },
    });
    if (!game) return failure('Das Spiel wurde nicht gefunden.');

    if (game._count.tournaments > 0) {
      return failure(
        `„${game.name}“ ist ${game._count.tournaments} Turnier(en) zugeordnet und kann deshalb nicht gelöscht werden. ` +
          'Deaktiviere es stattdessen – bestehende Turniere behalten ihre Zuordnung.',
      );
    }

    await prisma.tournamentGame.delete({ where: { id } });

    await recordAudit({
      action: AUDIT_ACTIONS.DELETE,
      entityType: 'TournamentGame',
      entityId: id,
      summary: `Spiel „${game.name}“ entfernt.`,
      actor: user,
    });

    refresh();
    return success('Das Spiel wurde entfernt.');
  });
}
