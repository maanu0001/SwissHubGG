import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';

/**
 * Erzeugt das Standardbild für Social-Media-Vorschauen (Open Graph).
 *
 * Das Bild entsteht serverseitig aus dem gelieferten Logo, den Markenfarben und
 * dem übergebenen Titel. Es wird lange zwischengespeichert, damit pro Seite
 * höchstens einmal gerendert wird.
 */

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;

async function loadAsset(relativePath: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), relativePath));
}

export async function GET(request: NextRequest): Promise<Response> {
  const settings = await getSettings();

  const title = (request.nextUrl.searchParams.get('titel') ?? settings.siteName).slice(0, 90);
  const subtitle = (request.nextUrl.searchParams.get('untertitel') ?? settings.motto).slice(0, 120);

  const [logo, regular, bold] = await Promise.all([
    loadAsset('public/brand/swisshub-logo-256.png'),
    loadAsset('src/assets/fonts/inter-latin-400-normal.woff'),
    loadAsset('src/assets/fonts/inter-latin-800-normal.woff'),
  ]);

  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background: 'linear-gradient(160deg, #14151b 0%, #0b0c10 60%, #2a0507 100%)',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={72} height={72} alt="" />
          <span style={{ fontSize: 34, fontWeight: 800, color: '#f4f5f7', letterSpacing: '-0.02em' }}>SwissHub</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              fontSize: title.length > 55 ? 52 : 64,
              fontWeight: 800,
              color: '#f4f5f7',
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 30, color: '#ff6b70', fontWeight: 400 }}>{subtitle}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Die Domain kommt aus der Konfiguration, damit das Vorschaubild
              bei einem Domainwechsel nicht als einzige Stelle zurückbleibt. */}
          <span style={{ fontSize: 24, color: '#b0b4be' }}>{new URL(env().APP_URL).host}</span>
          <div style={{ display: 'flex', width: '160px', height: '6px', background: '#83060a', borderRadius: '3px' }} />
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: bold, weight: 800, style: 'normal' },
      ],
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
