import type { NextConfig } from 'next';

/**
 * Sicherheitsheader, die für jede Antwort gelten.
 * Die Content-Security-Policy wird pro Request in der Middleware gesetzt,
 * weil sie eine zufällige Nonce enthält.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

/**
 * Öffentliche Hostnamen, unter denen die Anwendung erreichbar ist.
 *
 * Quelle ist `APP_URL`; zusätzliche Domains lassen sich über
 * `ADDITIONAL_ORIGINS` (kommagetrennt) ergänzen. Interne Adressen wie
 * `127.0.0.1:3001` gehören ausdrücklich **nicht** hierher – sie sind der
 * Weg des Proxys zur Anwendung, nicht die Herkunft der Besucher.
 */
function publicHosts(): string[] {
  const sources = [process.env.APP_URL, ...(process.env.ADDITIONAL_ORIGINS ?? '').split(',')];
  const hosts = new Set<string>();

  for (const source of sources) {
    const value = source?.trim();
    if (!value) continue;
    try {
      hosts.add(new URL(value.includes('://') ? value : `https://${value}`).host);
    } catch {
      // Eine unbrauchbare Angabe darf den Build nicht verhindern; die
      // Herkunftsprüfung bleibt dann einfach auf dem Standardverhalten.
      console.warn(`[next.config] Ungültige Origin-Angabe wird übersprungen: ${value}`);
    }
  }

  return [...hosts];
}

const nextConfig: NextConfig = {
  // Erzeugt einen schlanken, eigenständigen Server für das Produktions-Image.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Linting läuft als eigener Schritt (npm run lint); Next 16 führt ESLint
  // nicht mehr selbst während des Builds aus.
  typescript: {
    // Typfehler sollen den Produktions-Build bewusst abbrechen.
    ignoreBuildErrors: false,
  },

  images: {
    // Nur lokal gespeicherte Medien werden optimiert; externe Hosts sind bewusst nicht erlaubt.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1600, 1920],
    imageSizes: [64, 96, 128, 192, 256, 384],
    qualities: [70, 80, 90],
    dangerouslyAllowSVG: false,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
      /*
        Server Actions nehmen nur Anfragen der eigenen Domain entgegen: Next.js
        vergleicht den `Origin`-Kopf mit dem Host der Anfrage. Hinter einem
        Reverse Proxy ist das nur dann derselbe Wert, wenn der Proxy den
        ursprünglichen Host durchreicht (Apache: `ProxyPreserveHost On`,
        Nginx: `proxy_set_header Host $host`).

        Damit eine fehlende Weitergabe nicht zu einem stillen Speicherfehler
        führt, wird die öffentliche Domain zusätzlich ausdrücklich erlaubt. Das
        schwächt die Prüfung nicht ab – sie bleibt aktiv, es kommt genau eine
        bekannte, selbst konfigurierte Herkunft hinzu.
      */
      allowedOrigins: publicHosts(),
    },
  },

  /*
   * Die Route für Social-Vorschaubilder liest Schrift und Logo zur Laufzeit von
   * der Festplatte. Damit beides im eigenständigen Produktions-Image liegt,
   * werden die Dateien ausdrücklich mitgenommen.
   *
   * Hochgeladene Medien liegen bewusst ausserhalb des Bundles in einem
   * Datenverzeichnis (STORAGE_DIR) und werden über ein Volume eingebunden.
   */
  outputFileTracingIncludes: {
    '/api/og': ['./src/assets/fonts/*.woff', './public/brand/swisshub-logo-256.png'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Ausgelieferte Medien dürfen nie als HTML/Skript interpretiert werden.
        source: '/api/media/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Content-Disposition', value: 'inline' },
        ],
      },
    ];
  },
};

export default nextConfig;
