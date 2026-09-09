/**
 * Zahl, die beim ersten Sichtbarwerden hochzählt.
 *
 * Wichtig: Der endgültige, echte Wert steht bereits im Markup. Ohne
 * JavaScript, bei reduzierter Bewegung oder wenn der Wert keine Zahl ist,
 * erscheint er unverändert – es wird nie ein Wert erfunden oder simuliert.
 *
 * Das Hochzählen übernimmt die zentrale Bewegungs-Laufzeit; hier wird nur der
 * Zielwert ausgezeichnet.
 */

/**
 * Zerlegt gepflegte Werte wie „1200“, „1'200+“ oder „ca. 40“ in Vor-, Zahl-
 * und Nachtext. Nur ein sauber erkennbarer Zahlenwert wird animiert.
 */
function parseValue(value: string): { prefix: string; number: number; suffix: string } | null {
  // Die Zahlengruppe beginnt und endet auf einer Ziffer, damit Vor- und
  // Nachtext (z. B. „ca. “ oder „ Teams“) vollständig erhalten bleiben.
  const match = /^(\D*?)(\d(?:[\d'’.\s]*\d)?)(\D*)$/u.exec(value.trim());
  if (!match) return null;

  const [, prefix = '', digits = '', suffix = ''] = match;
  const numeric = Number(digits.replace(/['’.\s]/gu, ''));
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100_000_000) return null;

  return { prefix, number: numeric, suffix };
}

export function AnimatedNumber({ value, className = '' }: { value: string; className?: string }) {
  const parsed = parseValue(value);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span
      className={`numeric ${className}`}
      /*
        Die Bewegungs-Laufzeit verändert den Text dieses Elements, wenn es
        erstmals sichtbar wird. Das kann mit der Hydration zusammenfallen –
        deshalb wird der Textabgleich hier bewusst ausgesetzt. Der Endzustand
        ist immer exakt der gepflegte Wert.
      */
      suppressHydrationWarning
      data-countup={parsed.number}
      data-countup-prefix={parsed.prefix}
      data-countup-suffix={parsed.suffix}
      data-countup-final={value}
    >
      {value}
    </span>
  );
}
