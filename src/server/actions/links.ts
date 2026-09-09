'use server';

import { prisma } from '@/lib/db';
import { requirePermissionForAction } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { collectLinks, parseSections } from '@/lib/content/sections';
import { consumeRateLimit, RATE_LIMITS } from '@/lib/ratelimit';
import { safeUrl } from '@/lib/sanitize';

/**
 * Prüfung der in einer Seite verwendeten Links.
 *
 * Interne Ziele werden gegen die vorhandenen Seiten, Turniere und festen Routen
 * geprüft. Externe Ziele werden nur auf ausdrückliche Anforderung und einzeln
 * abgefragt (HEAD, kurzer Timeout), damit keine Dauerlast entsteht.
 */

export type LinkCheckResult = {
  href: string;
  label: string;
  scope: 'intern' | 'extern' | 'ungültig';
  status: 'ok' | 'fehlt' | 'fehler' | 'ungeprüft';
  detail: string;
};

const FIXED_ROUTES = new Set(['/', '/turniere', '/partner', '/social', '/kontakt']);

export async function checkPageLinksAction(pageId: string): Promise<LinkCheckResult[]> {
  const user = await requirePermissionForAction(PERMISSIONS.PAGES_VIEW);

  const limit = await consumeRateLimit(RATE_LIMITS.adminMutation, `linkcheck:${user.id}`);
  if (!limit.allowed) {
    return [
      {
        href: '',
        label: 'Prüfung',
        scope: 'intern',
        status: 'fehler',
        detail: 'Zu viele Prüfungen in kurzer Zeit. Bitte warte einen Moment.',
      },
    ];
  }

  const sections = await prisma.pageSection.findMany({
    where: { pageId },
    orderBy: { position: 'asc' },
    select: { id: true, type: true, visible: true, data: true },
  });

  const links = collectLinks(parseSections(sections));
  if (links.length === 0) return [];

  const [pages, tournaments] = await Promise.all([
    prisma.page.findMany({ where: { archivedAt: null }, select: { slug: true, status: true } }),
    prisma.tournament.findMany({ where: { archivedAt: null }, select: { slug: true, publishedAt: true } }),
  ]);

  const results: LinkCheckResult[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);

    const normalised = safeUrl(link.href);

    if (!normalised) {
      results.push({
        href: link.href,
        label: link.label,
        scope: 'ungültig',
        status: 'fehler',
        detail: 'Die Adresse ist leer oder verwendet ein nicht erlaubtes Protokoll.',
      });
      continue;
    }

    if (normalised.startsWith('/')) {
      const path = normalised.split(/[?#]/)[0] ?? normalised;

      if (FIXED_ROUTES.has(path)) {
        results.push({ href: normalised, label: link.label, scope: 'intern', status: 'ok', detail: 'Feste Route.' });
        continue;
      }

      const tournamentSlug = path.match(/^\/turniere\/([\w-]+)$/)?.[1];
      if (tournamentSlug) {
        const tournament = tournaments.find((entry) => entry.slug === tournamentSlug);
        results.push({
          href: normalised,
          label: link.label,
          scope: 'intern',
          status: tournament ? (tournament.publishedAt ? 'ok' : 'fehler') : 'fehlt',
          detail: tournament
            ? tournament.publishedAt
              ? 'Turnier ist veröffentlicht.'
              : 'Turnier existiert, ist aber nicht veröffentlicht.'
            : 'Es existiert kein Turnier mit dieser Adresse.',
        });
        continue;
      }

      const slug = path.replace(/^\//, '');
      const target = pages.find((entry) => entry.slug === slug);
      results.push({
        href: normalised,
        label: link.label,
        scope: 'intern',
        status: target ? (target.status === 'PUBLISHED' ? 'ok' : 'fehler') : 'fehlt',
        detail: target
          ? target.status === 'PUBLISHED'
            ? 'Seite ist veröffentlicht.'
            : 'Seite existiert, ist aber nicht veröffentlicht.'
          : 'Es existiert keine Seite mit dieser Adresse.',
      });
      continue;
    }

    if (normalised.startsWith('mailto:')) {
      results.push({
        href: normalised,
        label: link.label,
        scope: 'extern',
        status: 'ok',
        detail: 'E-Mail-Adresse.',
      });
      continue;
    }

    // Externe Adressen: eine einzelne, kurze Anfrage pro Link.
    try {
      const response = await fetch(normalised, {
        method: 'HEAD',
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      });

      results.push({
        href: normalised,
        label: link.label,
        scope: 'extern',
        status: response.ok || response.status === 405 ? 'ok' : 'fehler',
        detail: `HTTP ${response.status}`,
      });
    } catch {
      results.push({
        href: normalised,
        label: link.label,
        scope: 'extern',
        status: 'ungeprüft',
        detail: 'Die Adresse war nicht erreichbar oder hat zu lange gebraucht.',
      });
    }
  }

  return results;
}
