import 'server-only';
import { PageStatus, SponsorStatus, TournamentStatus, type SocialPlatform } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CacheTag, cached } from '@/lib/cache';
import { sortPosts, sortTournaments } from '@/lib/content/ordering';
import { FEATURE_FLAGS, isFeatureEnabled } from '@/lib/featureFlags';
import { parseSections, type RenderableSection } from '@/lib/content/sections';

/**
 * Lesezugriffe der öffentlichen Website.
 *
 * Alle Abfragen laufen über den getaggten Cache, damit ein Seitenaufruf im
 * Regelfall ohne Datenbankzugriff auskommt. Beim Veröffentlichen im Dashboard
 * werden genau die betroffenen Tags geleert.
 */

export type PublicPage = {
  id: string;
  slug: string;
  title: string;
  sections: RenderableSection[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageKey: string | null;
  seoNoIndex: boolean;
  canonicalUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
};

type PublishedSnapshot = {
  title?: string;
  sections?: { id: string; type: string; visible: boolean; data: unknown }[];
};

export async function getPublishedPage(slug: string): Promise<PublicPage | null> {
  return cached(
    `page:${slug}`,
    [CacheTag.pages, CacheTag.page(slug)],
    async () => {
      const page = await prisma.page.findFirst({
        where: { slug, status: PageStatus.PUBLISHED, archivedAt: null },
        include: { seoImage: { select: { storageKey: true } } },
      });

      if (!page || !page.publishedContent) return null;

      const snapshot = page.publishedContent as PublishedSnapshot;
      const rawSections = Array.isArray(snapshot.sections) ? snapshot.sections : [];

      const sections = parseSections(
        rawSections
          .filter((section) => section.visible !== false)
          .map((section) => ({
            id: String(section.id),
            type: section.type as RenderableSection['type'],
            visible: section.visible !== false,
            data: section.data,
          })),
      );

      return {
        id: page.id,
        slug: page.slug,
        title: snapshot.title ?? page.title,
        sections,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        seoImageKey: page.seoImage?.storageKey ?? null,
        seoNoIndex: page.seoNoIndex,
        canonicalUrl: page.canonicalUrl,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
      } satisfies PublicPage;
    },
  );
}

export async function listPublishedPageSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return cached(
    'pages:slugs',
    [CacheTag.pages],
    () =>
      prisma.page.findMany({
        where: { status: PageStatus.PUBLISHED, archivedAt: null, seoNoIndex: false },
        select: { slug: true, updatedAt: true },
        orderBy: { slug: 'asc' },
      }),
    900,
  );
}

// ---------------------------------------------------------------------------
// Turniere
// ---------------------------------------------------------------------------

const TOURNAMENT_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  summary: true,
  startsAt: true,
  endsAt: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  format: true,
  maxParticipants: true,
  participantUnit: true,
  prizeInfo: true,
  featured: true,
  winnerName: true,
  publishedAt: true,
  registrationUrl: true,
  streamUrl: true,
  banner: { select: { storageKey: true, alt: true, width: true, height: true } },
  game: { select: { slug: true, name: true, shortName: true } },
} as const;

export type TournamentListItem = Awaited<ReturnType<typeof fetchTournaments>>[number];

export const UPCOMING_STATUSES: TournamentStatus[] = [
  TournamentStatus.ANNOUNCED,
  TournamentStatus.REGISTRATION_OPEN,
  TournamentStatus.REGISTRATION_CLOSED,
];

export const PAST_STATUSES: TournamentStatus[] = [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED];

/**
 * Turniere lesen und in die öffentliche Reihenfolge bringen.
 *
 * Wichtig ist die Reihenfolge der Schritte: Erst alle infrage kommenden
 * Turniere lesen, dann sortieren, dann kürzen. Andernfalls würde die Datenbank
 * nach einem anderen Massstab kürzen als die Anzeige sortiert – eine Liste mit
 * drei Einträgen zeigte dann nicht die drei obersten.
 */
async function fetchTournaments(options: {
  statuses?: TournamentStatus[];
  gameSlug?: string;
  featuredOnly?: boolean;
  limit?: number;
}) {
  const rows = await prisma.tournament.findMany({
    where: {
      publishedAt: { not: null, lte: new Date() },
      archivedAt: null,
      status: options.statuses ? { in: options.statuses } : { not: TournamentStatus.DRAFT },
      ...(options.gameSlug ? { game: { slug: options.gameSlug } } : {}),
      ...(options.featuredOnly ? { featured: true } : {}),
    },
    select: TOURNAMENT_LIST_SELECT,
    // Vorsortierung in der Datenbank; die massgebliche Reihenfolge setzt
    // `sortTournaments`. Die Obergrenze schützt nur vor unbegrenzten Abfragen.
    orderBy: [{ startsAt: 'desc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    take: 500,
  });

  const sorted = sortTournaments(rows);
  return typeof options.limit === 'number' ? sorted.slice(0, options.limit) : sorted;
}

export async function getUpcomingTournaments(limit = 6) {
  return cached(`tournaments:upcoming:${limit}`, [CacheTag.tournaments], () =>
    fetchTournaments({ statuses: UPCOMING_STATUSES, limit }),
  );
}

export async function getRunningTournaments(limit = 6) {
  return cached(`tournaments:running:${limit}`, [CacheTag.tournaments], () =>
    fetchTournaments({ statuses: [TournamentStatus.RUNNING], limit }),
  );
}

export async function getPastTournaments(limit = 24) {
  return cached(`tournaments:past:${limit}`, [CacheTag.tournaments], () =>
    fetchTournaments({ statuses: PAST_STATUSES, limit }),
  );
}

export async function getFeaturedTournaments(limit = 3) {
  return cached(`tournaments:featured:${limit}`, [CacheTag.tournaments], () =>
    fetchTournaments({ featuredOnly: true, limit }),
  );
}

export async function getAllPublicTournaments() {
  return cached('tournaments:all', [CacheTag.tournaments], () => fetchTournaments({ limit: 200 }));
}

/**
 * Ist das Turnierarchiv abgeschaltet, sind vergangene Turniere nirgends
 * öffentlich sichtbar – weder in Listen noch als Detailseite noch in der
 * Sitemap. Der Schalter im Dashboard wirkt damit überall gleich.
 */
export async function isTournamentPubliclyVisible(status: TournamentStatus): Promise<boolean> {
  if (!PAST_STATUSES.includes(status)) return true;
  return isFeatureEnabled(FEATURE_FLAGS.tournamentArchive);
}

/** Wie {@link getAllPublicTournaments}, aber ohne durch Schalter ausgeblendete Turniere. */
export async function getVisiblePublicTournaments() {
  const [tournaments, archiveEnabled] = await Promise.all([
    getAllPublicTournaments(),
    isFeatureEnabled(FEATURE_FLAGS.tournamentArchive),
  ]);

  return archiveEnabled ? tournaments : tournaments.filter((t) => !PAST_STATUSES.includes(t.status));
}

export async function getTournamentBySlug(slug: string) {
  return cached(`tournament:${slug}`, [CacheTag.tournaments, CacheTag.tournament(slug)], () =>
    prisma.tournament.findFirst({
      where: { slug, publishedAt: { not: null, lte: new Date() }, archivedAt: null },
      include: {
        game: true,
        banner: { select: { storageKey: true, alt: true, width: true, height: true } },
        seoImage: { select: { storageKey: true } },
        teams: { orderBy: [{ seed: 'asc' }, { name: 'asc' }] },
        results: { orderBy: { placement: 'asc' }, include: { team: { select: { name: true, tag: true } } } },
        media: {
          orderBy: { position: 'asc' },
          include: { media: { select: { storageKey: true, alt: true, width: true, height: true } } },
        },
        sponsors: {
          orderBy: { position: 'asc' },
          include: {
            sponsor: {
              select: {
                id: true,
                slug: true,
                name: true,
                websiteUrl: true,
                status: true,
                logo: { select: { storageKey: true, alt: true, width: true, height: true } },
              },
            },
          },
        },
      },
    }),
  );
}

export async function getTournamentGames() {
  return cached('tournaments:games', [CacheTag.tournaments], () =>
    prisma.tournamentGame.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true, shortName: true },
    }),
  );
}

// ---------------------------------------------------------------------------
// Sponsoren
// ---------------------------------------------------------------------------

const SPONSOR_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  shortDescription: true,
  description: true,
  websiteUrl: true,
  partnerSince: true,
  partnerUntil: true,
  featured: true,
  sortOrder: true,
  logo: { select: { storageKey: true, alt: true, width: true, height: true } },
  tier: { select: { key: true, name: true, sortOrder: true } },
  tournaments: {
    where: { tournament: { publishedAt: { not: null }, archivedAt: null } },
    select: { tournament: { select: { slug: true, title: true, startsAt: true } } },
    take: 6,
  },
} as const;

export async function getSponsors(status: SponsorStatus | 'ALL' = SponsorStatus.ACTIVE, limit = 60) {
  return cached(`sponsors:${status}:${limit}`, [CacheTag.sponsors], () =>
    prisma.sponsor.findMany({
      where: {
        publishedAt: { not: null, lte: new Date() },
        archivedAt: null,
        ...(status === 'ALL' ? {} : { status }),
      },
      select: SPONSOR_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
    }),
  );
}

/**
 * Ein einzelner Partner für seine Detailseite.
 *
 * Es gelten dieselben Bedingungen wie in der Übersicht: Nur veröffentlichte und
 * nicht archivierte Partner sind öffentlich sichtbar. Ein Entwurf ist damit
 * auch dann nicht erreichbar, wenn die Adresse bekannt ist.
 */
export async function getSponsorBySlug(slug: string) {
  return cached(`sponsor:${slug}`, [CacheTag.sponsors], () =>
    prisma.sponsor.findFirst({
      where: { slug, publishedAt: { not: null, lte: new Date() }, archivedAt: null },
      select: SPONSOR_SELECT,
    }),
  );
}

/** Adressen aller öffentlich sichtbaren Partner – für die Sitemap. */
export async function listPublicSponsorSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return cached('sponsors:slugs', [CacheTag.sponsors], () =>
    prisma.sponsor.findMany({
      where: { publishedAt: { not: null, lte: new Date() }, archivedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    }),
  );
}

export async function getSponsorsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const key = `sponsors:ids:${[...ids].sort().join(',')}`;
  return cached(key, [CacheTag.sponsors], () =>
    prisma.sponsor.findMany({
      where: { id: { in: ids }, publishedAt: { not: null, lte: new Date() }, archivedAt: null },
      select: SPONSOR_SELECT,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  );
}

// ---------------------------------------------------------------------------
// Social Media
// ---------------------------------------------------------------------------

export async function getSocialAccounts() {
  return cached('social:accounts', [CacheTag.social], () =>
    prisma.socialAccount.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { platform: 'asc' }],
      select: {
        id: true,
        platform: true,
        handle: true,
        profileUrl: true,
        displayName: true,
        description: true,
        followerCount: true,
        followerCountUpdatedAt: true,
      },
    }),
  );
}

/**
 * Plattformen, für die es tatsächlich anzeigbare Beiträge gibt.
 *
 * Grundlage der Filter auf der Social-Media-Seite. Bewusst nicht aus den
 * gepflegten Accounts abgeleitet: Ein Kanal kann hinterlegt sein, ohne dass ein
 * einziger Beitrag freigegeben ist – ein Filter darauf führte ins Leere. Ebenso
 * bewusst nicht aus einer bereits begrenzten Beitragsliste, sonst verschwände
 * ein Filter, sobald die Beiträge einer Plattform gerade nicht unter die
 * ersten Treffer fallen.
 */
export async function getSocialPostPlatforms(): Promise<SocialPlatform[]> {
  return cached('social:post-platforms', [CacheTag.social], () =>
    prisma.socialPost
      .groupBy({
        by: ['platform'],
        where: { publishedAt: { not: null, lte: new Date() }, archivedAt: null },
        // Feste Reihenfolge, damit die Filter nicht von Abfrage zu Abfrage springen.
        orderBy: { platform: 'asc' },
      })
      .then((rows) => rows.map((row) => row.platform)),
  );
}

export async function getSocialPosts(options: {
  platforms?: SocialPlatform[];
  onlyFeatured?: boolean;
  limit?: number;
} = {}) {
  const key = `social:posts:${options.platforms?.join('|') ?? 'all'}:${options.onlyFeatured ? 'f' : 'a'}:${options.limit ?? 12}`;

  return cached(key, [CacheTag.social], () =>
    prisma.socialPost.findMany({
      where: {
        publishedAt: { not: null, lte: new Date() },
        archivedAt: null,
        ...(options.platforms && options.platforms.length > 0 ? { platform: { in: options.platforms } } : {}),
        ...(options.onlyFeatured ? { featured: true } : {}),
      },
      // Vorsortierung; massgeblich ist `sortPosts` weiter unten.
      orderBy: [{ postedAt: 'desc' }, { publishedAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        platform: true,
        type: true,
        title: true,
        excerpt: true,
        url: true,
        postedAt: true,
        featured: true,
        publishedAt: true,
        thumbnail: { select: { storageKey: true, alt: true, width: true, height: true } },
        account: { select: { handle: true, profileUrl: true } },
      },
    }).then((rows) => sortPosts(rows).slice(0, options.limit ?? 12)),
  );
}

// ---------------------------------------------------------------------------
// Team und Navigation
// ---------------------------------------------------------------------------

export async function getTeamMembers(limit = 24) {
  return cached(`team:${limit}`, [CacheTag.team], () =>
    prisma.teamMember.findMany({
      where: { active: true, publishedAt: { not: null, lte: new Date() } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
      select: {
        id: true,
        name: true,
        role: true,
        description: true,
        avatar: { select: { storageKey: true, alt: true } },
      },
    }),
  );
}

export type NavItem = {
  id: string;
  label: string;
  href: string;
  highlight: boolean;
  openInNewTab: boolean;
  children: NavItem[];
};

export async function getNavigation(key: 'main' | 'footer'): Promise<NavItem[]> {
  return cached(`navigation:${key}`, [CacheTag.navigation], async () => {
    const navigation = await prisma.navigation.findUnique({
      where: { key },
      include: {
        items: {
          where: { visible: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            label: true,
            href: true,
            highlight: true,
            openInNewTab: true,
            parentId: true,
          },
        },
      },
    });

    if (!navigation) return [];

    const byParent = new Map<string | null, NavItem[]>();
    for (const item of navigation.items) {
      const node: NavItem = {
        id: item.id,
        label: item.label,
        href: item.href,
        highlight: item.highlight,
        openInNewTab: item.openInNewTab,
        children: [],
      };
      const list = byParent.get(item.parentId) ?? [];
      list.push(node);
      byParent.set(item.parentId, list);
    }

    const attach = (nodes: NavItem[]): NavItem[] =>
      nodes.map((node) => ({ ...node, children: attach(byParent.get(node.id) ?? []) }));

    return attach(byParent.get(null) ?? []);
  }, 900);
}
