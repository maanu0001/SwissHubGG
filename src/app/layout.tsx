import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import './globals.css';
import { RouteTransition } from '@/components/site/RouteTransition';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { THEME_COOKIE, colorSchemeOf, resolveTheme, themeColorOf } from '@/lib/theme';
import { brandColorStyles } from '@/lib/brandColor';

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

/** Liest die gespeicherte Darstellung; ohne Wahl gilt die dunkle. */
async function currentTheme() {
  return resolveTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();

  return {
    themeColor: themeColorOf(theme),
    colorScheme: colorSchemeOf(theme),
    width: 'device-width',
    initialScale: 1,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
    Die Darstellung wird serverseitig aufgelöst und steht damit bereits im
    ausgelieferten HTML. Dadurch gibt es weder ein Aufblitzen der falschen
    Darstellung noch eine Abweichung zwischen Server- und Client-Ausgabe –
    und es braucht kein zusätzliches Skript vor dem Zeichnen.
  */
  const [theme, settings, headerList] = await Promise.all([currentTheme(), getSettings(), headers()]);

  /*
    Die Akzentfarbe aus dem Dashboard überschreibt ausschliesslich die
    Markenmerkmale des Designsystems – für beide Darstellungen in einer Regel,
    damit ein Wechsel zwischen hell und dunkel ohne Neuaufbau stimmt. Ist die
    Standardfarbe eingestellt, entsteht dieselbe Palette wie im Stylesheet.
  */
  const brandStyles = brandColorStyles(settings.brandColor);

  return (
    <html
      lang="de-CH"
      data-theme={theme}
      style={{ colorScheme: colorSchemeOf(theme) }}
      suppressHydrationWarning
    >
      <head>
        <style nonce={headerList.get('x-nonce') ?? undefined} dangerouslySetInnerHTML={{ __html: brandStyles }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-[var(--color-canvas)] text-[var(--color-ink)] antialiased">
        {/* Zentral für alle Bereiche: ein Seitenwechsel beginnt oben und
            entscheidet, ob die Einfluganimation gespielt wird. */}
        <RouteTransition />
        {children}
      </body>
    </html>
  );
}
