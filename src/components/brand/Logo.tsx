import Image from 'next/image';

/**
 * SwissHub-Bildmarke.
 *
 * Verwendet ausschliesslich die gelieferte Logodatei in technisch optimierten
 * Varianten. Das Seitenverhältnis ist fix 1:1, das Logo wird nie beschnitten,
 * eingefärbt oder verzerrt. Die Inszenierung findet ausschliesslich im Rahmen
 * darum statt – nie am Logo selbst.
 */

type LogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Dekorativ, wenn daneben bereits „SwissHub“ als Text steht. */
  decorative?: boolean;
};

export function LogoMark({ size = 40, className, priority = false, decorative = false }: LogoProps) {
  return (
    <Image
      src="/brand/swisshub-logo-256.png"
      alt={decorative ? '' : 'SwissHub'}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      priority={priority}
      className={className}
      sizes={`${size}px`}
      // Das Seitenverhältnis ist fix 1:1 und wird nie verändert.
      style={{ aspectRatio: '1 / 1' }}
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
}: {
  /** Rahmenbreite; responsiv, damit die Marke auf Smartphones nicht dominiert. */
  size?: 'hero' | 'compact';
  priority?: boolean;
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

      {/* Feste Bildgrösse, per CSS proportional skaliert – nie verzerrt. */}
      <span className="relative block w-[64%]">
        <LogoMark size={256} priority={priority} className="h-auto w-full" />
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
};

/** Bildmarke plus Wortmarke – die Standarddarstellung in Header und Footer. */
export function LogoLockup({
  size = 36,
  className = '',
  priority = false,
  suffix,
  interactive = false,
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
        <LogoMark size={size} priority={priority} decorative />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-[var(--color-ink)]">SwissHub</span>
        {suffix ? (
          <span className="meta mt-1 text-[10px] tracking-[0.18em]">{suffix}</span>
        ) : null}
      </span>
    </span>
  );
}
