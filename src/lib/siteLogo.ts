import 'server-only';
import { MediaKind } from '@prisma/client';
import { prisma } from '@/lib/db';
import { CacheTag, cached } from '@/lib/cache';
import { mediaUrl } from '@/lib/media';
import { getSettings } from '@/lib/settings';
import { DEFAULT_LOGO, type SiteLogo } from '@/lib/brandLogo';

/**
 * Ermittelt das aktuell gültige Hauptlogo.
 *
 * Die Auflösung ist bewusst nachsichtig: Zeigt die Einstellung auf ein Medium,
 * das gelöscht wurde, kein Bild ist oder sich gerade nicht laden lässt, wird
 * die mitgelieferte Bildmarke ausgeliefert. Ein leerer Kopfbereich oder ein
 * Fehler in der Auslieferung wäre für Besucher deutlich schlimmer als ein
 * kurzzeitig nicht übernommenes Logo.
 */
export async function getSiteLogo(): Promise<SiteLogo> {
  const settings = await getSettings();
  const alt = settings.siteName.trim() || DEFAULT_LOGO.alt;
  const mediaId = settings.logoMediaId;

  if (!mediaId) return { ...DEFAULT_LOGO, alt };

  const asset = await cached(`site:logo:${mediaId}`, [CacheTag.settings], async () => {
    try {
      return await prisma.mediaAsset.findFirst({
        where: { id: mediaId, kind: MediaKind.IMAGE },
        select: { storageKey: true, width: true, height: true },
      });
    } catch (error) {
      // Beim Produktions-Build ist die Datenbank nicht zwingend erreichbar.
      console.warn('Hauptlogo konnte nicht geladen werden, Bildmarke wird verwendet:', error);
      return null;
    }
  });

  if (!asset) return { ...DEFAULT_LOGO, alt };

  return {
    src: mediaUrl(asset.storageKey),
    // Ohne bekannte Abmessungen bliebe das Seitenverhältnis offen; dann gilt
    // die quadratische Annahme der mitgelieferten Bildmarke.
    width: asset.width ?? DEFAULT_LOGO.width,
    height: asset.height ?? DEFAULT_LOGO.height,
    alt,
  };
}
