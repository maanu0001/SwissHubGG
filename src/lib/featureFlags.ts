import 'server-only';
import { prisma } from '@/lib/db';
import { CacheTag, cached } from '@/lib/cache';

/**
 * Feature-Schalter für optionale Bereiche der Website.
 *
 * Jeder Schalter steuert tatsächlich einen sichtbaren Bereich – es gibt keine
 * Schalter ohne Wirkung. Die Werte laufen über den getaggten Cache und werden
 * beim Umschalten im Dashboard gezielt geleert.
 */

export const FEATURE_FLAGS = {
  socialHighlights: 'social-highlights',
  teamSection: 'team-section',
  tournamentArchive: 'tournament-archive',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Standardwerte, falls ein Schalter (noch) nicht in der Datenbank steht. */
const DEFAULTS: Record<FeatureFlagKey, boolean> = {
  'social-highlights': true,
  'team-section': true,
  'tournament-archive': true,
};

async function loadFlags(): Promise<Record<string, boolean>> {
  try {
    const flags = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
    return Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled]));
  } catch {
    // Beim Produktions-Build ist die Datenbank nicht zwingend erreichbar.
    return {};
  }
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return cached('feature-flags', [CacheTag.featureFlags], loadFlags, 600);
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key] ?? DEFAULTS[key];
}
