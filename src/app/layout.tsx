import type { Metadata, Viewport } from 'next';
import './globals.css';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';

/**
 * Wurzel-Layout. Enthält nur das Grundgerüst; Kopf- und Fussbereich der
 * öffentlichen Website liegen im Layout der Route-Gruppe `(site)`, damit der
 * Admin-Bereich ein eigenes Layout verwenden kann.
 */

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    metadataBase: new URL(env().APP_URL),
    title: {
      default: settings.seoDefaultTitle,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.seoDefaultDescription,
    applicationName: settings.siteName,
    generator: null,
    referrer: 'strict-origin-when-cross-origin',
    formatDetection: { telephone: false, address: false, email: false },
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: '48x48' },
        { url: '/brand/swisshub-logo-128.png', type: 'image/png', sizes: '128x128' },
      ],
      apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
    },
    manifest: '/site.webmanifest',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'de_CH',
      siteName: settings.siteName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b0c10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de-CH" suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">
        {children}
      </body>
    </html>
  );
}
