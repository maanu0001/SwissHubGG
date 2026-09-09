import 'server-only';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MediaKind } from '@prisma/client';
import { env } from '@/lib/env';
import { randomToken, sha256 } from '@/lib/crypto';

/**
 * Sichere Ablage und Auslieferung hochgeladener Dateien.
 *
 * Kernpunkte:
 *  - Dateien liegen ausserhalb von `public/` und werden nur über eine
 *    kontrollierte Route ausgeliefert (nie direkt vom Webserver ausgeführt).
 *  - Der Dateityp wird anhand der tatsächlichen Signatur geprüft, nicht anhand
 *    der Endung oder des vom Browser gemeldeten MIME-Typs.
 *  - Bilder werden neu kodiert. Dabei fallen EXIF-Daten und eventuell
 *    eingebettete Nutzlasten weg.
 *  - Dateinamen werden serverseitig zufällig vergeben; Pfadanteile aus dem
 *    Upload werden verworfen.
 */

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'] as const;
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

type Signature = { mime: string; kind: MediaKind; test: (buffer: Buffer) => boolean };

const SIGNATURES: Signature[] = [
  { mime: 'image/jpeg', kind: MediaKind.IMAGE, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    kind: MediaKind.IMAGE,
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    kind: MediaKind.IMAGE,
    test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'image/avif',
    kind: MediaKind.IMAGE,
    test: (b) => b.subarray(4, 8).toString('ascii') === 'ftyp' && ['avif', 'avis'].includes(b.subarray(8, 12).toString('ascii')),
  },
  {
    mime: 'image/gif',
    kind: MediaKind.IMAGE,
    test: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii')),
  },
  {
    mime: 'application/pdf',
    kind: MediaKind.DOCUMENT,
    test: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaValidationError';
  }
}

export function storageRoot(): string {
  return path.resolve(process.cwd(), env().STORAGE_DIR);
}

/**
 * Löst einen Speicherschlüssel in einen absoluten Pfad auf und stellt sicher,
 * dass er das Speicherverzeichnis nicht verlässt (Schutz vor Pfadmanipulation).
 */
export function resolveStoragePath(storageKey: string): string {
  if (!/^[a-zA-Z0-9/_-]+\.[a-zA-Z0-9]{1,8}$/.test(storageKey) || storageKey.includes('..')) {
    throw new MediaValidationError('Ungültiger Speicherschlüssel.');
  }

  const root = storageRoot();
  const absolute = path.resolve(root, storageKey);

  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new MediaValidationError('Ungültiger Speicherschlüssel.');
  }
  return absolute;
}

export function detectType(buffer: Buffer): { mime: string; kind: MediaKind } {
  const match = SIGNATURES.find((signature) => signature.test(buffer));
  if (!match) {
    throw new MediaValidationError(
      'Dieser Dateityp wird nicht unterstützt. Erlaubt sind JPEG, PNG, WebP, AVIF, GIF und PDF.',
    );
  }
  return { mime: match.mime, kind: match.kind };
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export type StoredMedia = {
  storageKey: string;
  mimeType: string;
  kind: MediaKind;
  byteSize: number;
  width: number | null;
  height: number | null;
  checksum: string;
};

/** Maximale Kantenlänge – begrenzt Speicherbedarf und Auslieferungskosten. */
const MAX_DIMENSION = 2560;

export async function storeUpload(input: Buffer, options?: { subdirectory?: string }): Promise<StoredMedia> {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (input.byteLength === 0) {
    throw new MediaValidationError('Die Datei ist leer.');
  }
  if (input.byteLength > maxBytes) {
    throw new MediaValidationError(`Die Datei ist grösser als ${env().MAX_UPLOAD_MB} MB.`);
  }

  const detected = detectType(input);
  let payload = input;
  let width: number | null = null;
  let height: number | null = null;
  let mimeType = detected.mime;

  if (detected.kind === MediaKind.IMAGE && detected.mime !== 'image/gif') {
    // Neu kodieren: entfernt Metadaten und potenziell eingebettete Inhalte.
    const pipeline = sharp(input, { failOn: 'error' }).rotate();
    const metadata = await pipeline.metadata();

    const resized =
      (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION
        ? pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        : pipeline;

    const encoded =
      detected.mime === 'image/png'
        ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
        : await resized.webp({ quality: 86 }).toBuffer({ resolveWithObject: true });

    payload = encoded.data;
    width = encoded.info.width;
    height = encoded.info.height;
    mimeType = detected.mime === 'image/png' ? 'image/png' : 'image/webp';
  } else if (detected.mime === 'image/gif') {
    const metadata = await sharp(input, { failOn: 'none' }).metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
  }

  const extension = EXTENSIONS[mimeType] ?? 'bin';
  const now = new Date();
  const directory = options?.subdirectory
    ? path.posix.join('private', sanitiseSegment(options.subdirectory))
    : path.posix.join('media', String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'));

  const storageKey = path.posix.join(directory, `${randomToken(16)}.${extension}`);
  const absolute = resolveStoragePath(storageKey);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, payload, { mode: 0o640 });

  return {
    storageKey,
    mimeType,
    kind: detected.kind,
    byteSize: payload.byteLength,
    width,
    height,
    checksum: sha256(payload),
  };
}

function sanitiseSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleaned.length === 0) throw new MediaValidationError('Ungültiges Zielverzeichnis.');
  return cleaned;
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storageKey));
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  await rm(resolveStoragePath(storageKey), { force: true });
}

/** Öffentliche URL eines Mediums. Die Route prüft Existenz und Content-Type. */
export function mediaUrl(storageKey: string): string {
  return `/api/media/${storageKey}`;
}
