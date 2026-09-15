import Image from 'next/image';
import { DEFAULT_LOGO, type SiteLogo } from '@/lib/brandLogo';

/**
 * Bildmarke der Website.
 *
 * Dargestellt wird das im Dashboard gepflegte Hauptlogo; ohne Angabe die
 * mitgelieferte Datei. Das Seitenverhältnis stammt immer aus dem Bild selbst –
 * das Logo wird nie beschnitten, eingefärbt, gestaucht oder verzerrt. Die
 * Inszenierung findet ausschliesslich im Rahmen darum statt.
 */

type LogoProps = {
  /** Anzeigehöhe in Pixeln (`fit="bar"`) bzw. Referenzgrösse für `sizes`. */
  size?: number;
  className?: string;
  priority?: boolean;
  /** Dekorativ, wenn daneben bereits der Name der Website als Text steht. */
  decorative?: boolean;
  /** Gepflegtes Hauptlogo; ohne Angabe gilt die mitgelieferte Bildmarke. */
  logo?: SiteLogo;
  /**
   * `bar` richtet das Logo an seiner Höhe aus – die Standardform in Kopf- und
   * Fussbereich, wo die Zeilenhöhe zählt. `box` überlässt die Abmessungen dem
   * Container: Der Aufrufer gibt eine Fläche vor, das Logo passt sich
   * proportional hinein.
   */
  fit?: 'bar' | 'box';
  /** Abweichende Layoutbreiten; ohne Angabe gilt die Anzeigegrösse. */
  sizes?: string;
};

export function LogoMark({
  size = 40,
  className,
  priority = false,
  decorative = false,
  logo = DEFAULT_LOGO,
  fit = 'bar',
  sizes,
}: LogoProps) {
  return (
    <Image
      src={logo.src}
      alt={decorative ? '' : logo.alt}
      aria-hidden={decorative || undefined}
      /*
        Die echten Abmessungen des Bildes. Daraus ergibt sich das
        Seitenverhältnis; eine der beiden Kanten wird unten festgelegt, die
        andere folgt – deshalb kann nichts verzerren.
      */
      width={logo.width}
      height={logo.height}
      priority={priority}
      className={className}
      sizes={sizes ?? `${size}px`}
      style={
        fit === 'bar'
          ? {
              height: size,
              width: 'auto',
              // Ein sehr breites Logo darf den Kopfbereich nicht sprengen;
              // `contain` verkleinert es dann weiter, statt es zu beschneiden.
              maxWidth: size * 4,
              objectFit: 'contain',
            }
          : { objectFit: 'contain' }
      }
    />
  );
}

/**
 * Logo in einem technischen Rahmen: Ring, Eckmarken und ein ruhiger Lichtkranz
 * hinter der Marke. Das Logo selbst bleibt unverändert.
 */
export function LogoStage({
  size = 'hero',
  priority = false,
  logo,
}: {
  /** Rahmenbreite; responsiv, damit die Marke auf Smartphones nicht dominiert. */
  size?: 'hero' | 'compact';
  priority?: boolean;
  logo?: SiteLogo;
}) {
  const frame =
    size === 'hero' ? 'clamp(11rem, 34vw, 17rem)' : 'clamp(8rem, 26vw, 11rem)';

  return (
    <div
      className="relative flex aspect-square items-center justify-center"
      style={{ width: frame }}
      data-ambient
    >
      {/* Lichtkranz */}
      <span
        aria-hidden="true"
        className="glow-orb glow-brand drift-slow absolute inset-0 opacity-55"
        style={{ filter: 'blur(46px)' }}
      />

      {/* Äusserer Ring mit Eckmarken */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-[28%] border border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-surface)_55%,transparent)] backdrop-blur-sm"
      />
      <span
        aria-hidden="true"
        className="absolute inset-[9%] rounded-[26%] border border-[color-mix(in_srgb,var(--color-brand)_38%,transparent)]"
      />

      {/*
        Quadratische Fläche, in die sich das Logo proportional einpasst. Ein
        breites oder hohes Logo wird dadurch kleiner, nie verzerrt und nie über
        den Ring hinausgeschoben.
      */}
      <span className="relative block aspect-square w-[64%]">
        <LogoMark size={256} priority={priority} logo={logo} fit="box" className="h-full w-full" />
      </span>
    </div>
  );
}

type LogoLockupProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Zusatzzeile unter dem Namen, z. B. „Admin-Dashboard“. */
  suffix?: string;
  /** Dezente Bewegung beim Überfahren – nur im Kopfbereich sinnvoll. */
  interactive?: boolean;
  /** Gepflegtes Hauptlogo; ohne Angabe gilt die mitgelieferte Bildmarke. */
  logo?: SiteLogo;
  /** Wortmarke neben dem Bild; ohne Angabe der Standardname. */
  name?: string;
};

/** Bildmarke plus Wortmarke – die Standarddarstellung in Header und Footer. */
export function LogoLockup({
  size = 36,
  className = '',
  priority = false,
  suffix,
  interactive = false,
  logo,
  name,
}: LogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={
          interactive
            ? 'inline-flex transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:scale-[1.06]'
            : 'inline-flex'
        }
      >
        <LogoMark size={size} priority={priority} logo={logo} decorative />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-[var(--color-ink)]">
          {name ?? logo?.alt ?? DEFAULT_LOGO.alt}
        </span>
        {suffix ? (
          <span className="meta mt-1 text-[10px] tracking-[0.18em]">{suffix}</span>
        ) : null}
      </span>
    </span>
  );
}
