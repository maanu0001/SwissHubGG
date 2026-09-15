import type { SocialPlatform } from '@prisma/client';

/**
 * Plattformfilter der Social-Media-Seite.
 *
 * Grundlage sind ausschliesslich die Plattformen, zu denen es tatsächlich
 * anzeigbare Beiträge gibt – nicht die gepflegten Kanäle. Ein Kanal kann
 * hinterlegt sein, ohne dass ein einziger Beitrag freigegeben ist; ein Filter
 * darauf führte ins Leere und meldete „0 Beiträge gefunden“.
 *
 * Die Regeln stehen hier und nicht in der Seite, damit sie ohne Browser
 * prüfbar sind.
 */

/**
 * Reihenfolge der Filter.
 *
 * Führend ist die Reihenfolge der gepflegten Kanäle – dieselbe wie in der
 * Kanalübersicht darüber. Plattformen, zu denen es Beiträge, aber keinen
 * (aktiven) Kanal mehr gibt, hängen danach an: Ihre Beiträge sind weiterhin
 * sichtbar und sollen auch auffindbar bleiben.
 */
export function socialFilterPlatforms(
  accountOrder: SocialPlatform[],
  withPosts: SocialPlatform[],
): SocialPlatform[] {
  const vorhanden = new Set(withPosts);
  return [...new Set([...accountOrder.filter((platform) => vorhanden.has(platform)), ...withPosts])];
}

/**
 * Löst den Filter aus der Adresse auf.
 *
 * Alles, was nicht zu einer Plattform mit Beiträgen gehört – ein altes
 * Lesezeichen, ein Tippfehler, ein Kanal ohne Beiträge – wird stillschweigend
 * zu „Alle“. Der aktive Filter zeigt dadurch nie auf eine leere Auswahl.
 */
export function resolveSocialPlatform(
  requested: string | undefined,
  available: SocialPlatform[],
): SocialPlatform | null {
  if (!requested) return null;
  const gesucht = requested.toUpperCase() as SocialPlatform;
  return available.includes(gesucht) ? gesucht : null;
}

/**
 * Ob die Filterzeile überhaupt angezeigt wird.
 *
 * Bei nur einer Plattform hätten „Alle“ und die Plattform dasselbe Ergebnis,
 * ohne Beiträge gäbe es gar nichts zu filtern. In beiden Fällen entfällt der
 * Bereich vollständig, statt eine wirkungslose Bedienung anzubieten.
 */
export function showSocialFilters(platforms: SocialPlatform[]): boolean {
  return platforms.length > 1;
}
