import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';

// Wird pro Anfrage erzeugt, damit der Produktions-Build keine Datenbank benötigt.
export const dynamic = 'force-dynamic';

/**
 * robots.txt. Im Wartungsmodus wird die Indexierung vollständig unterbunden,
 * damit keine Wartungsseite in den Suchindex gelangt.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = env().APP_URL;
  const settings = await getSettings();

  if (settings.maintenanceMode) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/vorschau/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
