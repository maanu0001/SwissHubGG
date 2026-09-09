import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { getPublishedPage } from '@/lib/content/queries';
import { buildMetadata, breadcrumbJsonLd } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { JsonLd } from '@/components/site/JsonLd';

/**
 * Alle über das CMS gepflegten Seiten (z. B. „Über uns“, Impressum,
 * Datenschutz). Existiert kein veröffentlichter Inhalt, greift die
 * Weiterleitungsverwaltung, bevor eine 404-Seite ausgeliefert wird.
 */

type PageProps = { params: Promise<{ slug: string }> };

/** Diese Pfade haben eigene Routen und dürfen hier nicht behandelt werden. */
const RESERVED_SLUGS = new Set(['home', 'turniere', 'partner', 'social', 'kontakt', 'admin', 'api']);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  if (!page) {
    return { title: 'Seite nicht gefunden', robots: { index: false, follow: false } };
  }

  return buildMetadata({
    title: page.seoTitle ?? page.title,
    description: page.seoDescription,
    path: `/${slug}`,
    imageKey: page.seoImageKey,
    noIndex: page.seoNoIndex,
    canonicalOverride: page.canonicalUrl,
    type: 'article',
    publishedTime: page.publishedAt,
  });
}

export default async function CmsPage({ params }: PageProps) {
  const { slug } = await params;

  if (RESERVED_SLUGS.has(slug)) {
    notFound();
  }

  const page = await getPublishedPage(slug);

  if (!page) {
    // Geänderte Slugs bleiben über die Weiterleitungsverwaltung erreichbar.
    const redirectRule = await prisma.redirect.findFirst({
      where: { source: `/${slug}`, active: true },
      select: { id: true, destination: true, statusCode: true },
    });

    if (redirectRule) {
      await prisma.redirect.update({
        where: { id: redirectRule.id },
        data: { hits: { increment: 1 }, lastHitAt: new Date() },
      });

      if (redirectRule.statusCode === 307 || redirectRule.statusCode === 302) {
        redirect(redirectRule.destination);
      }
      permanentRedirect(redirectRule.destination);
    }

    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Start', path: '/' },
          { name: page.title, path: `/${slug}` },
        ])}
      />
      <SectionRenderer sections={page.sections} />
    </>
  );
}
