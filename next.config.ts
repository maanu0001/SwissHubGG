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
    // Server Actions nehmen nur Anfragen der eigenen Domain entgegen.
    serverActions: {
      bodySizeLimit: '12mb',
    },
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
