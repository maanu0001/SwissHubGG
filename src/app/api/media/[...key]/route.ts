import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { MediaValidationError, readStoredFile } from '@/lib/media';
import { getCurrentUser, userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';

/**
 * Ausliefern gespeicherter Dateien.
 *
 * Dateien liegen ausserhalb des öffentlichen Verzeichnisses und werden nur über
 * diese Route ausgeliefert. Der Content-Type stammt aus der Datenbank, nie aus
 * der Anfrage; `X-Content-Type-Options: nosniff` verhindert eine Umdeutung
 * durch den Browser. Private Anhänge aus dem Kontaktformular erfordern eine
 * gültige Berechtigung.
 */

export const runtime = 'nodejs';

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> },
): Promise<NextResponse> {
  const { key } = await context.params;
  const storageKey = key.join('/');

  // Private Anhänge: nur mit Leseberechtigung für Kontaktanfragen.
  if (storageKey.startsWith('private/')) {
    const user = await getCurrentUser();
    if (!userHasPermission(user, PERMISSIONS.CONTACT_READ)) {
      return new NextResponse('Nicht gefunden', { status: 404 });
    }

    const attachment = await prisma.contactAttachment.findUnique({
      where: { storageKey },
      select: { mimeType: true, originalName: true },
    });

    if (!attachment) {
      return new NextResponse('Nicht gefunden', { status: 404 });
    }

    try {
      const file = await readStoredFile(storageKey);
      return new NextResponse(new Uint8Array(file), {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Length': String(file.byteLength),
          'Content-Security-Policy': "default-src 'none'; sandbox",
          'X-Content-Type-Options': 'nosniff',
          // Anhänge werden zum Download angeboten, nicht im Browser gerendert.
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } catch {
      return new NextResponse('Nicht gefunden', { status: 404 });
    }
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { storageKey },
    select: { mimeType: true, byteSize: true },
  });

  if (!asset) {
    return new NextResponse('Nicht gefunden', { status: 404 });
  }

  try {
    const file = await readStoredFile(storageKey);

    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(file.byteLength),
        // Der Speicherschlüssel ist zufällig und ändert sich bei jedem Upload,
        // daher kann sehr lange zwischengespeichert werden.
        'Cache-Control': IMMUTABLE_CACHE,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return new NextResponse('Ungültiger Pfad', { status: 400 });
    }
    return new NextResponse('Nicht gefunden', { status: 404 });
  }
}
