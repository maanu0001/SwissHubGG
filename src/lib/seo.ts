import 'server-only';
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { mediaUrl } from '@/lib/media';
import { toPlainText } from '@/lib/sanitize';

/**
 * Zentrale SEO-Bausteine: Metadaten, Canonicals und strukturierte Daten.
 * Titel und Beschreibungen sind pro Seite im Dashboard überschreibbar.
 */

export function absoluteUrl(pathname: string): string {
  const base = env().APP_URL;
  if (!pathname || pathname === '/') return base;
  return `${base}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

type MetadataInput = {
  title?: string | null;
  description?: string | null;
  path: string;
  imageKey?: string | null;
  noIndex?: boolean;
  canonicalOverride?: string | null;
  type?: 'website' | 'article';
  publishedTime?: Date | null;
};

export async function buildMetadata(input: MetadataInput): Promise<Metadata> {
  const settings = await getSettings();

  const title = input.title?.trim() || settings.seoDefaultTitle;
  const description = toPlainText(input.description?.trim() || settings.seoDefaultDescription, 180);
  const canonical = input.canonicalOverride?.trim() || absoluteUrl(input.path);

  const imageKey = input.imageKey ?? null;
  const imageUrl = imageKey ? absoluteUrl(mediaUrl(imageKey)) : absoluteUrl('/api/og');

  return {
    title,
    description,
    alternates: { canonical },
    robots: input.noIndex
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    openGraph: {
      type: input.type ?? 'website',
      title,
      description,
      url: canonical,
      siteName: settings.siteName,
      locale: 'de_CH',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      ...(input.publishedTime ? { publishedTime: input.publishedTime.toISOString() } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Strukturierte Daten (JSON-LD)
// ---------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

export async function organizationJsonLd(socialUrls: string[]): Promise<JsonLd> {
  const settings = await getSettings();

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${env().APP_URL}/#organization`,
    name: settings.siteName,
    alternateName: 'SwissHub Gaming Community',
    url: env().APP_URL,
    logo: absoluteUrl('/brand/swisshub-logo-512.png'),
    description: settings.seoDefaultDescription,
    email: settings.contactEmail || undefined,
    slogan: settings.motto || undefined,
    foundingDate: '2021',
    areaServed: { '@type': 'Country', name: 'Schweiz' },
    ...(socialUrls.length > 0 ? { sameAs: socialUrls } : {}),
  };
}

export async function websiteJsonLd(): Promise<JsonLd> {
  const settings = await getSettings();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${env().APP_URL}/#website`,
    name: settings.siteName,
    url: env().APP_URL,
    inLanguage: 'de-CH',
    publisher: { '@id': `${env().APP_URL}/#organization` },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

type TournamentJsonLdInput = {
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  bannerKey: string | null;
  registrationUrl: string | null;
  gameName: string | null;
};

/** Turniere werden als Online-Event ausgezeichnet. */
export function tournamentJsonLd(input: TournamentJsonLdInput, organizationId: string): JsonLd | null {
  if (!input.startsAt) return null;

  const statusMap: Record<string, string> = {
    CANCELLED: 'https://schema.org/EventCancelled',
    COMPLETED: 'https://schema.org/EventScheduled',
    RUNNING: 'https://schema.org/EventScheduled',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.title,
    url: absoluteUrl(`/turniere/${input.slug}`),
    description: toPlainText(input.summary ?? input.description ?? '', 300) || undefined,
    startDate: input.startsAt.toISOString(),
    endDate: (input.endsAt ?? input.startsAt).toISOString(),
    eventStatus: statusMap[input.status] ?? 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: input.registrationUrl ?? absoluteUrl(`/turniere/${input.slug}`),
    },
    image: input.bannerKey ? absoluteUrl(mediaUrl(input.bannerKey)) : undefined,
    organizer: { '@id': organizationId },
    ...(input.gameName ? { about: { '@type': 'VideoGame', name: input.gameName } } : {}),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]): JsonLd | null {
  if (items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: toPlainText(item.answer, 800) },
    })),
  };
}
