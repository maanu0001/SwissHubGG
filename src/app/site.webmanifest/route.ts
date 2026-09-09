import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/** Web-App-Manifest auf Basis der gepflegten Einstellungen und Markenassets. */
export async function GET(): Promise<NextResponse> {
  const settings = await getSettings();

  return NextResponse.json(
    {
      name: `${settings.siteName} – Schweizer Gaming-Community`,
      short_name: settings.siteName,
      description: settings.seoDefaultDescription,
      lang: 'de-CH',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0b0c10',
      theme_color: '#0b0c10',
      icons: [
        { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
