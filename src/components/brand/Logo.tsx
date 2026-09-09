import Image from 'next/image';

/**
 * SwissHub-Bildmarke.
 *
 * Verwendet ausschliesslich die gelieferte Logodatei in technisch optimierten
 * Varianten. Das Seitenverhältnis ist fix 1:1; die Grösse steuert die
 * Schutzzone über das umgebende Layout.
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
    />
  );
}

type LogoLockupProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Zusatzzeile unter dem Namen, z. B. „Admin-Dashboard“. */
  suffix?: string;
};

/** Bildmarke plus Wortmarke – die Standarddarstellung in Header und Footer. */
export function LogoLockup({ size = 36, className = '', priority = false, suffix }: LogoLockupProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} priority={priority} decorative />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-tight text-[var(--color-ink)]">SwissHub</span>
        {suffix ? (
          <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-subtle)]">
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
