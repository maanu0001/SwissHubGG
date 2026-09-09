'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { TournamentStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { CacheTag, invalidateTags } from '@/lib/cache';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';
import { slugify } from '@/lib/format';
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

/** Verwaltung von Turnieren, Spielen, Teams, Ergebnissen und Sponsorenzuordnung. */

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function refresh(slug?: string): void {
  invalidateTags(CacheTag.tournaments, ...(slug ? [CacheTag.tournament(slug)] : []));
  revalidatePath('/turniere');
  if (slug) revalidatePath(`/turniere/${slug}`);
  revalidatePath('/');
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.tournament.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

export async function createTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);

    const title = text(formData, 'title');
    if (title.length < 3) {
      return failure('Bitte prüfe die markierten Felder.', { title: 'Der Titel muss mindestens 3 Zeichen haben.' });
    }

    const requested = text(formData, 'slug') || slugify(title);
    if (!slugPattern.test(requested)) {
      return failure('Bitte prüfe die markierten Felder.', {
        slug: 'Die URL darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.',
      });
    }

    const slug = await uniqueSlug(requested);

    const tournament = await prisma.tournament.create({
      data: { title, slug, status: TournamentStatus.DRAFT, gameId: optionalText(formData, 'gameId') },
      select: { id: true, title: true, slug: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.CREATE,
      entityType: 'Tournament',
      entityId: tournament.id,
      summary: `Turnier „${tournament.title}“ als Entwurf angelegt.`,
      metadata: { slug },
      actor: user,
    });

    return success('Das Turnier wurde angelegt.', { id: tournament.id });
  });

  if (result.status === 'success' && result.data?.id) {
    redirect(`/admin/turniere/${result.data.id}`);
  }
  return result;
}

const statusValues = Object.values(TournamentStatus) as [TournamentStatus, ...TournamentStatus[]];

export async function updateTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const id = text(formData, 'id');

    const existing = await prisma.tournament.findUnique({ where: { id }, select: { slug: true, title: true } });
    if (!existing) return failure('Das Turnier wurde nicht gefunden.');

    const title = text(formData, 'title');
    if (title.length < 3) {
      return failure('Bitte prüfe die markierten Felder.', { title: 'Der Titel muss mindestens 3 Zeichen haben.' });
    }

    const requestedSlug = text(formData, 'slug');
    if (!slugPattern.test(requestedSlug)) {
      return failure('Bitte prüfe die markierten Felder.', { slug: 'Ungültige URL.' });
    }
    const slug = await uniqueSlug(requestedSlug, id);

    const status = z.enum(statusValues).safeParse(text(formData, 'status'));
    if (!status.success) return failure('Bitte prüfe die markierten Felder.', { status: 'Ungültiger Status.' });

    const startsAt = dateTime(formData, 'startsAt');
    const endsAt = dateTime(formData, 'endsAt');
    if (startsAt && endsAt && endsAt < startsAt) {
      return failure('Bitte prüfe die markierten Felder.', { endsAt: 'Das Ende muss nach dem Start liegen.' });
    }

    const registrationOpensAt = dateTime(formData, 'registrationOpensAt');
    const registrationClosesAt = dateTime(formData, 'registrationClosesAt');
    if (registrationOpensAt && registrationClosesAt && registrationClosesAt < registrationOpensAt) {
      return failure('Bitte prüfe die markierten Felder.', {
        registrationClosesAt: 'Das Anmeldeende muss nach dem Anmeldestart liegen.',
      });
    }

    await prisma.tournament.update({
      where: { id },
      data: {
        title,
        slug,
        status: status.data,
        gameId: optionalText(formData, 'gameId'),
        summary: optionalText(formData, 'summary'),
        description: optionalText(formData, 'description'),
        bannerId: optionalText(formData, 'bannerId'),
        startsAt,
        endsAt,
        registrationOpensAt,
        registrationClosesAt,
        format: optionalText(formData, 'format'),
        rules: optionalText(formData, 'rules'),
        maxParticipants: integer(formData, 'maxParticipants'),
        participantUnit: text(formData, 'participantUnit') === 'PLAYER' ? 'PLAYER' : 'TEAM',
        prizeInfo: optionalText(formData, 'prizeInfo'),
        registrationUrl: optionalText(formData, 'registrationUrl'),
        streamUrl: optionalText(formData, 'streamUrl'),
        discordUrl: optionalText(formData, 'discordUrl'),
        resultSummary: optionalText(formData, 'resultSummary'),
        winnerName: optionalText(formData, 'winnerName'),
        recapUrl: optionalText(formData, 'recapUrl'),
        featured: checkbox(formData, 'featured'),
        sortOrder: integer(formData, 'sortOrder') ?? 0,
        seoTitle: optionalText(formData, 'seoTitle'),
        seoDescription: optionalText(formData, 'seoDescription'),
        seoImageId: optionalText(formData, 'seoImageId'),
        scheduledPublishAt: dateTime(formData, 'scheduledPublishAt'),
      },
    });

    if (slug !== existing.slug) {
      await prisma.redirect.upsert({
        where: { source: `/turniere/${existing.slug}` },
        create: {
          source: `/turniere/${existing.slug}`,
          destination: `/turniere/${slug}`,
          statusCode: 308,
          note: 'Automatisch beim Ändern der Turnier-URL erstellt.',
        },
        update: { destination: `/turniere/${slug}`, active: true },
      });
      refresh(existing.slug);
    }

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: id,
      summary: `Turnier „${title}“ bearbeitet.`,
      metadata: { slug, status: status.data },
      actor: user,
    });

    refresh(slug);
    return success('Das Turnier wurde gespeichert.');
  });
}

export async function publishTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_PUBLISH);
    const id = text(formData, 'id');

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { slug: true, title: true, publishedAt: true, status: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    const publishing = tournament.publishedAt === null;

    await prisma.tournament.update({
      where: { id },
      data: publishing
        ? {
            publishedAt: new Date(),
            scheduledPublishAt: null,
            archivedAt: null,
            ...(tournament.status === TournamentStatus.DRAFT ? { status: TournamentStatus.ANNOUNCED } : {}),
          }
        : { publishedAt: null },
    });

    await recordAudit({
      action: publishing ? AUDIT_ACTIONS.PUBLISH : AUDIT_ACTIONS.UNPUBLISH,
      entityType: 'Tournament',
      entityId: id,
      summary: publishing
        ? `Turnier „${tournament.title}“ veröffentlicht.`
        : `Turnier „${tournament.title}“ zurückgezogen.`,
      metadata: { slug: tournament.slug },
      actor: user,
    });

    refresh(tournament.slug);
    return success(publishing ? 'Das Turnier ist jetzt öffentlich sichtbar.' : 'Das Turnier ist nicht mehr öffentlich.');
  });
}

export async function archiveTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_PUBLISH);
    const id = text(formData, 'id');

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { slug: true, title: true, archivedAt: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    const restoring = tournament.archivedAt !== null;

    await prisma.tournament.update({
      where: { id },
      data: restoring
        ? { archivedAt: null }
        : { archivedAt: new Date(), status: TournamentStatus.ARCHIVED },
    });

    await recordAudit({
      action: restoring ? AUDIT_ACTIONS.RESTORE : AUDIT_ACTIONS.ARCHIVE,
      entityType: 'Tournament',
      entityId: id,
      summary: restoring
        ? `Turnier „${tournament.title}“ wiederhergestellt.`
        : `Turnier „${tournament.title}“ archiviert.`,
      actor: user,
    });

    refresh(tournament.slug);
    return success(restoring ? 'Das Turnier wurde wiederhergestellt.' : 'Das Turnier wurde archiviert.');
  });
}

export async function duplicateTournamentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const id = text(formData, 'id');

    const source = await prisma.tournament.findUnique({ where: { id }, include: { sponsors: true } });
    if (!source) return failure('Das Turnier wurde nicht gefunden.');

    const slug = await uniqueSlug(`${source.slug}-kopie`);

    const copy = await prisma.tournament.create({
      data: {
        title: `${source.title} (Kopie)`,
        slug,
        status: TournamentStatus.DRAFT,
        gameId: source.gameId,
        summary: source.summary,
        description: source.description,
        bannerId: source.bannerId,
        format: source.format,
        rules: source.rules,
        maxParticipants: source.maxParticipants,
        participantUnit: source.participantUnit,
        prizeInfo: source.prizeInfo,
        discordUrl: source.discordUrl,
        sponsors: {
          create: source.sponsors.map((entry) => ({
            sponsorId: entry.sponsorId,
            role: entry.role,
            position: entry.position,
          })),
        },
      },
      select: { id: true },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.DUPLICATE,
      entityType: 'Tournament',
      entityId: copy.id,
      summary: `Turnier „${source.title}“ dupliziert.`,
      metadata: { sourceId: source.id },
      actor: user,
    });

    return success('Das Turnier wurde dupliziert.', { id: copy.id });
  });

  if (result.status === 'success' && result.data?.id) {
    redirect(`/admin/turniere/${result.data.id}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Teams und Ergebnisse
// ---------------------------------------------------------------------------

export async function saveTeamAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const tournamentId = text(formData, 'tournamentId');
    const name = text(formData, 'name');

    if (name.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Der Name muss mindestens 2 Zeichen haben.' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { slug: true, title: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    const duplicate = await prisma.tournamentTeam.findFirst({ where: { tournamentId, name }, select: { id: true } });
    if (duplicate) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Dieser Name ist bereits erfasst.' });
    }

    await prisma.tournamentTeam.create({
      data: {
        tournamentId,
        name,
        tag: optionalText(formData, 'tag'),
        contact: optionalText(formData, 'contact'),
        seed: integer(formData, 'seed'),
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: tournamentId,
      summary: `Teilnehmer „${name}“ zum Turnier „${tournament.title}“ hinzugefügt.`,
      actor: user,
    });

    refresh(tournament.slug);
    return success('Der Teilnehmer wurde hinzugefügt.');
  });
}

export async function deleteTeamAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const teamId = text(formData, 'teamId');

    const team = await prisma.tournamentTeam.findUnique({
      where: { id: teamId },
      select: { name: true, tournament: { select: { id: true, slug: true, title: true } } },
    });
    if (!team) return failure('Der Teilnehmer wurde nicht gefunden.');

    await prisma.tournamentTeam.delete({ where: { id: teamId } });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: team.tournament.id,
      summary: `Teilnehmer „${team.name}“ aus Turnier „${team.tournament.title}“ entfernt.`,
      actor: user,
    });

    refresh(team.tournament.slug);
    return success('Der Teilnehmer wurde entfernt.');
  });
}

export async function saveResultAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const tournamentId = text(formData, 'tournamentId');
    const placement = integer(formData, 'placement');
    const displayName = text(formData, 'displayName');

    if (!placement || placement < 1) {
      return failure('Bitte prüfe die markierten Felder.', { placement: 'Bitte gib eine Platzierung ab 1 an.' });
    }
    if (displayName.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { displayName: 'Bitte gib einen Namen an.' });
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { slug: true, title: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    await prisma.tournamentResult.upsert({
      where: { tournamentId_placement: { tournamentId, placement } },
      create: {
        tournamentId,
        placement,
        displayName,
        teamId: optionalText(formData, 'teamId'),
        prize: optionalText(formData, 'prize'),
        note: optionalText(formData, 'note'),
      },
      update: {
        displayName,
        teamId: optionalText(formData, 'teamId'),
        prize: optionalText(formData, 'prize'),
        note: optionalText(formData, 'note'),
      },
    });

    // Der erste Platz wird zusätzlich als Gewinner am Turnier hinterlegt.
    if (placement === 1) {
      await prisma.tournament.update({ where: { id: tournamentId }, data: { winnerName: displayName } });
    }

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: tournamentId,
      summary: `Ergebnis Platz ${placement} („${displayName}“) für Turnier „${tournament.title}“ gespeichert.`,
      actor: user,
    });

    refresh(tournament.slug);
    return success('Das Ergebnis wurde gespeichert.');
  });
}

export async function deleteResultAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const resultId = text(formData, 'resultId');

    const entry = await prisma.tournamentResult.findUnique({
      where: { id: resultId },
      select: { placement: true, tournament: { select: { id: true, slug: true, title: true } } },
    });
    if (!entry) return failure('Das Ergebnis wurde nicht gefunden.');

    await prisma.tournamentResult.delete({ where: { id: resultId } });

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: entry.tournament.id,
      summary: `Ergebnis Platz ${entry.placement} aus Turnier „${entry.tournament.title}“ entfernt.`,
      actor: user,
    });

    refresh(entry.tournament.slug);
    return success('Das Ergebnis wurde entfernt.');
  });
}

// ---------------------------------------------------------------------------
// Sponsorenzuordnung und Medien
// ---------------------------------------------------------------------------

export async function setTournamentSponsorsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const tournamentId = text(formData, 'tournamentId');
    const sponsorIds = formData.getAll('sponsorIds').filter((entry): entry is string => typeof entry === 'string');

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { slug: true, title: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    await prisma.$transaction([
      prisma.tournamentSponsor.deleteMany({ where: { tournamentId } }),
      prisma.tournamentSponsor.createMany({
        data: sponsorIds.map((sponsorId, index) => ({ tournamentId, sponsorId, position: index })),
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: tournamentId,
      summary: `Sponsorenzuordnung für Turnier „${tournament.title}“ aktualisiert (${sponsorIds.length}).`,
      actor: user,
    });

    refresh(tournament.slug);
    invalidateTags(CacheTag.sponsors);
    return success('Die Sponsorenzuordnung wurde gespeichert.');
  });
}

export async function setTournamentMediaAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const tournamentId = text(formData, 'tournamentId');
    const mediaIds = formData.getAll('mediaIds').filter((entry): entry is string => typeof entry === 'string');

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { slug: true, title: true },
    });
    if (!tournament) return failure('Das Turnier wurde nicht gefunden.');

    await prisma.$transaction([
      prisma.tournamentMedia.deleteMany({ where: { tournamentId } }),
      prisma.tournamentMedia.createMany({
        data: mediaIds.map((mediaId, index) => ({ tournamentId, mediaId, position: index })),
        skipDuplicates: true,
      }),
    ]);

    await recordAudit({
      action: AUDIT_ACTIONS.UPDATE,
      entityType: 'Tournament',
      entityId: tournamentId,
      summary: `Galerie des Turniers „${tournament.title}“ aktualisiert (${mediaIds.length} Medien).`,
      actor: user,
    });

    refresh(tournament.slug);
    return success('Die Galerie wurde gespeichert.');
  });
}

// ---------------------------------------------------------------------------
// Spiele / Kategorien
// ---------------------------------------------------------------------------

export async function saveGameAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requirePermissionForAction(PERMISSIONS.TOURNAMENTS_MANAGE);
    const name = text(formData, 'name');

    if (name.length < 2) {
      return failure('Bitte prüfe die markierten Felder.', { name: 'Bitte gib einen Namen an.' });
    }

    const slug = slugify(text(formData, 'slug') || name);
    const existingId = optionalText(formData, 'id');

    const conflict = await prisma.tournamentGame.findFirst({
      where: { slug, ...(existingId ? { id: { not: existingId } } : {}) },
      select: { id: true },
    });
    if (conflict) {
      return failure('Bitte prüfe die markierten Felder.', { slug: 'Dieses Spiel ist bereits erfasst.' });
    }

    const data = {
      name,
      slug,
      shortName: optionalText(formData, 'shortName'),
      description: optionalText(formData, 'description'),
      sortOrder: integer(formData, 'sortOrder') ?? 0,
      active: checkbox(formData, 'active'),
    };

    if (existingId) {
      await prisma.tournamentGame.update({ where: { id: existingId }, data });
    } else {
      await prisma.tournamentGame.create({ data });
    }

    await recordAudit({
      action: existingId ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
      entityType: 'TournamentGame',
      entityId: existingId ?? undefined,
      summary: `Spiel „${name}“ ${existingId ? 'bearbeitet' : 'angelegt'}.`,
      actor: user,
    });

    refresh();
    return success(existingId ? 'Das Spiel wurde gespeichert.' : 'Das Spiel wurde angelegt.');
  });
}
