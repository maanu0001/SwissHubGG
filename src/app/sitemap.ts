import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getVisiblePublicTournaments, listPublishedPageSlugs } from '@/lib/content/queries';

// Wird pro Anfrage erzeugt, damit der Produktions-Build keine Datenbank benötigt.
export const dynamic = 'force-dynamic';

/**
 * XML-Sitemap.
 *
 * Enthält nur veröffentlichte, indexierbare Inhalte. Entwürfe, Vorschauen und
 * der Admin-Bereich erscheinen nie. Die Liste aktualisiert sich automatisch,
 * sobald Inhalte veröffentlicht werden.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().APP_URL;
  const [pages, tournaments] = await Promise.all([listPublishedPageSlugs(), getVisiblePublicTournaments()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/turniere`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/partner`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/social`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/kontakt`, changeFrequency: 'yearly', priority: 0.5 },
  ];

  const cmsRoutes: MetadataRoute.Sitemap = pages
    .filter((page) => page.slug !== 'home')
    .map((page) => ({
      url: `${base}/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

  const tournamentRoutes: MetadataRoute.Sitemap = tournaments.map((tournament) => ({
    url: `${base}/turniere/${tournament.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...cmsRoutes, ...tournamentRoutes];
}
