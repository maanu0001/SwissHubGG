import Image from 'next/image';
import { mediaUrl } from '@/lib/media';

/**
 * Bild aus der Medienbibliothek.
 *
 * Nutzt die Bildoptimierung von Next.js (AVIF/WebP, responsive Grössen).
 * Bilder ohne bekannte Abmessungen werden mit `fill` in einem Container mit
 * definiertem Seitenverhältnis dargestellt, damit kein Layout-Sprung entsteht.
 */

type MediaImageProps = {
  storageKey: string;
  alt: string | null | undefined;
  width?: number | null;
  height?: number | null;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Wenn gesetzt, füllt das Bild den Container (dieser braucht `position: relative`). */
  fill?: boolean;
  quality?: 70 | 80 | 90;
};

export function MediaImage({
  storageKey,
  alt,
  width,
  height,
  sizes,
  className,
  priority = false,
  fill = false,
  quality = 80,
}: MediaImageProps) {
  const source = mediaUrl(storageKey);
  // Ein leerer Alt-Text ist gültig und markiert rein dekorative Bilder.
  const alternative = alt ?? '';

  if (fill || !width || !height) {
    return (
      <Image
        src={source}
        alt={alternative}
        fill
        sizes={sizes}
        quality={quality}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={className}
      />
    );
  }

  return (
    <Image
      src={source}
      alt={alternative}
      width={width}
      height={height}
      sizes={sizes}
      quality={quality}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      className={className}
    />
  );
}
