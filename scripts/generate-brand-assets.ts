/**
 * Erzeugt technisch optimierte Webvarianten des gelieferten SwissHub-Logos.
 *
 * Wichtig: Die Bildmarke wird ausschliesslich skaliert und vom einfarbig
 * schwarzen Hintergrund der Quelldatei befreit. Es finden keine gestalterischen
 * Änderungen statt – kein Zuschnitt, keine Verzerrung, keine Farbänderung.
 * Das Seitenverhältnis (1:1) bleibt in allen Varianten erhalten.
 *
 * Aufruf: npm run brand:icons
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'brand-source', 'swisshub-logo.jpg');
const OUT_DIR = path.join(ROOT, 'public', 'brand');

/** Grundfläche des dunklen SwissHub-Designs – für Icons, die keine Transparenz erlauben. */
const PLATE = { r: 11, g: 12, b: 16, alpha: 1 } as const;

/**
 * Der Quell-JPEG hat einen exakt schwarzen Hintergrund. Wir leiten daraus einen
 * Alphakanal ab, damit die Marke auf hellen wie dunklen Flächen sauber sitzt.
 * Sehr dunkle Pixel werden transparent, ein schmaler Übergangsbereich wird weich
 * ausgeblendet, damit keine harten Treppenkanten entstehen.
 */
async function buildTransparentMark(): Promise<Buffer> {
  const image = sharp(SOURCE).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const LOWER = 16; // darunter: vollständig transparent
  const UPPER = 56; // darüber: vollständig deckend
  const out = Buffer.alloc(info.width * info.height * 4);

  for (let i = 0; i < info.width * info.height; i += 1) {
    const o = i * info.channels;
    const r = data[o] ?? 0;
    const g = data[o + 1] ?? 0;
    const b = data[o + 2] ?? 0;
    const luminance = Math.max(r, g, b);

    let alpha = 255;
    if (luminance <= LOWER) alpha = 0;
    else if (luminance < UPPER) alpha = Math.round(((luminance - LOWER) / (UPPER - LOWER)) * 255);

    const t = i * 4;
    out[t] = r;
    out[t + 1] = g;
    out[t + 2] = b;
    out[t + 3] = alpha;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Minimaler ICO-Container mit eingebetteten PNG-Bildern (von allen aktuellen Browsern unterstützt). */
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserviert
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(images.length, 4);

  const entries: Buffer[] = [];
  let offset = 6 + images.length * 16;

  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // Farbpalette
    entry.writeUInt8(0, 3); // reserviert
    entry.writeUInt16LE(1, 4); // Farbebenen
    entry.writeUInt16LE(32, 6); // Bit pro Pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const mark = await buildTransparentMark();
  const write = (name: string, buffer: Buffer) => writeFile(path.join(OUT_DIR, name), buffer);

  // Transparente Bildmarke in mehreren Auflösungen (PNG + WebP)
  await write('swisshub-logo.png', mark);
  for (const size of [512, 256, 128, 64]) {
    const resized = sharp(mark).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await write(`swisshub-logo-${size}.png`, await resized.clone().png({ compressionLevel: 9 }).toBuffer());
    await write(`swisshub-logo-${size}.webp`, await resized.clone().webp({ quality: 92 }).toBuffer());
  }

  // App-Icons auf der dunklen Markenfläche (Transparenz ist dort unerwünscht)
  const onPlate = async (size: number, padding: number) => {
    const inner = await sharp(mark)
      .resize(size - padding * 2, size - padding * 2, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return sharp({
      create: { width: size, height: size, channels: 4, background: PLATE },
    })
      .composite([{ input: inner, top: padding, left: padding }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  };

  await write('apple-touch-icon.png', await onPlate(180, 18));
  await write('icon-192.png', await onPlate(192, 20));
  await write('icon-512.png', await onPlate(512, 54));
  // Maskable-Icon braucht mehr Sicherheitsabstand (Safe Zone von 80 %).
  await write('icon-maskable-512.png', await onPlate(512, 96));

  // Favicon mit mehreren Auflösungen
  const icoImages = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      png: await sharp(mark)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    })),
  );
  await writeFile(path.join(ROOT, 'public', 'favicon.ico'), buildIco(icoImages));

  console.log(`Markenassets erzeugt in ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((error: unknown) => {
  console.error('Erzeugung der Markenassets fehlgeschlagen:', error);
  process.exit(1);
});
