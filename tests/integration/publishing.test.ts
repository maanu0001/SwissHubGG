import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PageStatus, type Prisma, TournamentStatus } from '@prisma/client';
import { prepareSchema, resetDatabase, testPrisma } from '../setup/testDb';
import { parseSections } from '@/lib/content/sections';

/**
 * Integrationstests des Veröffentlichungsablaufs.
 *
 * Kern der Prüfung: Ein Entwurf darf die öffentliche Website nie erreichen, und
 * veröffentlichte Inhalte bleiben stabil, bis ausdrücklich neu veröffentlicht
 * wird.
 */

beforeAll(() => {
  prepareSchema();
});

beforeEach(async () => {
  await resetDatabase();
});

async function createDraftPage(slug = 'testseite') {
  return testPrisma.page.create({
    data: {
      slug,
      title: 'Testseite',
      status: PageStatus.DRAFT,
      sections: {
        create: [
          { type: 'HERO', position: 0, visible: true, data: { headline: 'Erste Fassung' } },
          { type: 'TEXT', position: 1, visible: true, data: { text: 'Ein Absatz.' } },
        ],
      },
    },
    include: { sections: { orderBy: { position: 'asc' } } },
  });
}

async function publish(pageId: string): Promise<void> {
  const page = await testPrisma.page.findUniqueOrThrow({
    where: { id: pageId },
    include: { sections: { orderBy: { position: 'asc' } } },
  });

  const snapshot = {
    title: page.title,
    sections: page.sections.map((section) => ({
      id: section.id,
      type: section.type,
      visible: section.visible,
      data: section.data,
    })),
  };

  const latest = await testPrisma.pageVersion.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  await testPrisma.$transaction([
    testPrisma.page.update({
      where: { id: pageId },
      data: {
        status: PageStatus.PUBLISHED,
        publishedContent: snapshot as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    }),
    testPrisma.pageVersion.create({
      data: {
        pageId,
        version: (latest?.version ?? 0) + 1,
        changeType: 'publish',
        content: snapshot as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
}

/** Bildet die öffentliche Leseabfrage nach. */
async function readPublicPage(slug: string) {
  const page = await testPrisma.page.findFirst({
    where: { slug, status: PageStatus.PUBLISHED, archivedAt: null },
  });
  if (!page?.publishedContent) return null;

  const snapshot = page.publishedContent as { title: string; sections: { id: string; type: string; visible: boolean; data: unknown }[] };
  return {
    title: snapshot.title,
    sections: parseSections(
      snapshot.sections.map((section) => ({
        id: section.id,
        type: section.type as never,
        visible: section.visible,
        data: section.data,
      })),
    ),
  };
}

describe('Entwurf, Vorschau und Veröffentlichung', () => {
  it('liefert einen Entwurf nicht öffentlich aus', async () => {
    const page = await createDraftPage();
    expect(await readPublicPage(page.slug)).toBeNull();
  });

  it('veröffentlicht den Entwurf als Snapshot und legt eine Version an', async () => {
    const page = await createDraftPage();
    await publish(page.id);

    const published = await readPublicPage(page.slug);
    expect(published?.sections).toHaveLength(2);
    expect(published?.sections[0]?.type).toBe('HERO');

    const versions = await testPrisma.pageVersion.findMany({ where: { pageId: page.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe(1);
  });

  it('zeigt Änderungen am Entwurf erst nach erneutem Veröffentlichen', async () => {
    const page = await createDraftPage();
    await publish(page.id);

    const heroId = page.sections[0]?.id as string;
    await testPrisma.pageSection.update({
      where: { id: heroId },
      data: { data: { headline: 'Zweite Fassung' } },
    });

    const stillOld = await readPublicPage(page.slug);
    const hero = stillOld?.sections.find((section) => section.type === 'HERO');
    expect(hero && 'headline' in hero.data && hero.data.headline).toBe('Erste Fassung');

    await publish(page.id);
    const updated = await readPublicPage(page.slug);
    const updatedHero = updated?.sections.find((section) => section.type === 'HERO');
    expect(updatedHero && 'headline' in updatedHero.data && updatedHero.data.headline).toBe('Zweite Fassung');
  });

  it('nimmt eine Seite beim Zurückziehen aus der öffentlichen Auslieferung', async () => {
    const page = await createDraftPage();
    await publish(page.id);

    await testPrisma.page.update({ where: { id: page.id }, data: { status: PageStatus.DRAFT } });
    expect(await readPublicPage(page.slug)).toBeNull();
  });

  it('zählt Versionen fortlaufend und erlaubt die Wiederherstellung', async () => {
    const page = await createDraftPage();
    await publish(page.id);

    const heroId = page.sections[0]?.id as string;
    await testPrisma.pageSection.update({ where: { id: heroId }, data: { data: { headline: 'Zweite Fassung' } } });
    await publish(page.id);

    const versions = await testPrisma.pageVersion.findMany({ where: { pageId: page.id }, orderBy: { version: 'asc' } });
    expect(versions.map((version) => version.version)).toEqual([1, 2]);

    // Wiederherstellung: Abschnitte aus Version 1 zurückschreiben.
    const first = versions[0]?.content as { sections: { type: string; visible: boolean; data: unknown }[] };
    await testPrisma.$transaction([
      testPrisma.pageSection.deleteMany({ where: { pageId: page.id } }),
      testPrisma.page.update({
        where: { id: page.id },
        data: {
          sections: {
            create: first.sections.map((section, index) => ({
              type: section.type as never,
              position: index,
              visible: section.visible,
              data: section.data as Prisma.InputJsonValue,
            })),
          },
        },
      }),
    ]);

    const restored = await testPrisma.pageSection.findFirst({
      where: { pageId: page.id, type: 'HERO' },
    });
    expect((restored?.data as { headline: string }).headline).toBe('Erste Fassung');

    // Öffentlich ist weiterhin Version 2 sichtbar, bis erneut veröffentlicht wird.
    const publicPage = await readPublicPage(page.slug);
    const hero = publicPage?.sections.find((section) => section.type === 'HERO');
    expect(hero && 'headline' in hero.data && hero.data.headline).toBe('Zweite Fassung');
  });

  it('erzwingt eindeutige Slugs', async () => {
    await createDraftPage('doppelt');
    await expect(createDraftPage('doppelt')).rejects.toThrow();
  });
});

describe('Turniere', () => {
  it('zeigt nur veröffentlichte, nicht archivierte Turniere öffentlich an', async () => {
    const game = await testPrisma.tournamentGame.create({
      data: { slug: 'counter-strike-2', name: 'Counter-Strike 2' },
    });

    await testPrisma.tournament.createMany({
      data: [
        { slug: 'entwurf', title: 'Entwurf', status: TournamentStatus.DRAFT, gameId: game.id },
        {
          slug: 'sichtbar',
          title: 'Sichtbar',
          status: TournamentStatus.REGISTRATION_OPEN,
          gameId: game.id,
          publishedAt: new Date(Date.now() - 1000),
        },
        {
          slug: 'archiviert',
          title: 'Archiviert',
          status: TournamentStatus.COMPLETED,
          gameId: game.id,
          publishedAt: new Date(Date.now() - 1000),
          archivedAt: new Date(),
        },
        {
          slug: 'spaeter',
          title: 'Später',
          status: TournamentStatus.ANNOUNCED,
          gameId: game.id,
          publishedAt: new Date(Date.now() + 3600_000),
        },
      ],
    });

    const visible = await testPrisma.tournament.findMany({
      where: { publishedAt: { not: null, lte: new Date() }, archivedAt: null, status: { not: TournamentStatus.DRAFT } },
      select: { slug: true },
    });

    expect(visible.map((entry) => entry.slug)).toEqual(['sichtbar']);
  });

  it('erlaubt pro Turnier nur eine Platzierung je Rang', async () => {
    const tournament = await testPrisma.tournament.create({
      data: { slug: 'cup', title: 'Cup', status: TournamentStatus.COMPLETED },
    });

    await testPrisma.tournamentResult.create({
      data: { tournamentId: tournament.id, placement: 1, displayName: 'Team A' },
    });

    await expect(
      testPrisma.tournamentResult.create({
        data: { tournamentId: tournament.id, placement: 1, displayName: 'Team B' },
      }),
    ).rejects.toThrow();
  });

  it('entfernt Teams und Ergebnisse mit dem Turnier', async () => {
    const tournament = await testPrisma.tournament.create({
      data: {
        slug: 'cup-2',
        title: 'Cup 2',
        status: TournamentStatus.COMPLETED,
        teams: { create: [{ name: 'Team A' }, { name: 'Team B' }] },
        results: { create: [{ placement: 1, displayName: 'Team A' }] },
      },
    });

    await testPrisma.tournament.delete({ where: { id: tournament.id } });

    expect(await testPrisma.tournamentTeam.count()).toBe(0);
    expect(await testPrisma.tournamentResult.count()).toBe(0);
  });
});

describe('Sponsoren und Social-Beiträge', () => {
  it('zeigt nur veröffentlichte Sponsoren an', async () => {
    await testPrisma.sponsor.createMany({
      data: [
        { slug: 'intern', name: 'Intern' },
        { slug: 'sichtbar', name: 'Sichtbar', publishedAt: new Date(Date.now() - 1000) },
        { slug: 'archiviert', name: 'Archiviert', publishedAt: new Date(Date.now() - 1000), archivedAt: new Date() },
      ],
    });

    const visible = await testPrisma.sponsor.findMany({
      where: { publishedAt: { not: null, lte: new Date() }, archivedAt: null },
      select: { slug: true },
    });

    expect(visible.map((entry) => entry.slug)).toEqual(['sichtbar']);
  });

  it('behält Beiträge, wenn ein Account gelöscht wird', async () => {
    const account = await testPrisma.socialAccount.create({
      data: { platform: 'TWITCH', handle: 'swisshub', profileUrl: 'https://twitch.tv/swisshub' },
    });

    const post = await testPrisma.socialPost.create({
      data: {
        platform: 'TWITCH',
        title: 'Stream-Highlight',
        url: 'https://twitch.tv/swisshub/clip/1',
        accountId: account.id,
      },
    });

    await testPrisma.socialAccount.delete({ where: { id: account.id } });

    const reloaded = await testPrisma.socialPost.findUnique({ where: { id: post.id } });
    expect(reloaded).not.toBeNull();
    expect(reloaded?.accountId).toBeNull();
  });
});
