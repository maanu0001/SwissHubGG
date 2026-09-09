import { formatDate, formatNumber } from '@/lib/format';

/**
 * Kompakter Verlauf als reines SVG.
 *
 * Bewusst ohne Diagrammbibliothek: das spart ein grosses Paket im Bundle. Die
 * Werte stehen zusätzlich als Tabelle für Screenreader zur Verfügung, damit die
 * Information nicht nur grafisch vorliegt.
 */
export function MetricSparkline({
  series,
  label,
}: {
  series: { day: Date; count: number }[];
  label: string;
}) {
  if (series.length === 0) {
    return <p className="text-sm text-[var(--color-ink-subtle)]">Für diesen Zeitraum liegen keine Daten vor.</p>;
  }

  const max = Math.max(...series.map((entry) => entry.count), 1);
  const total = series.reduce((sum, entry) => sum + entry.count, 0);
  const width = 100;
  const height = 28;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  const points = series
    .map((entry, index) => `${(index * step).toFixed(2)},${(height - (entry.count / max) * height).toFixed(2)}`)
    .join(' ');

  return (
    <figure>
      <figcaption className="mb-2 flex items-baseline justify-between text-xs text-[var(--color-ink-subtle)]">
        <span>{label}</span>
        <span>
          Gesamt: {formatNumber(total)} · Spitze: {formatNumber(max)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`${label}: ${formatNumber(total)} insgesamt, Höchstwert ${formatNumber(max)}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-brand-text)"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-[var(--color-ink-subtle)]">Werte als Tabelle</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th scope="col" className="py-1 text-left font-medium text-[var(--color-ink-subtle)]">Tag</th>
                <th scope="col" className="py-1 text-right font-medium text-[var(--color-ink-subtle)]">Anzahl</th>
              </tr>
            </thead>
            <tbody>
              {series.map((entry) => (
                <tr key={entry.day.toISOString()}>
                  <td className="py-0.5 text-[var(--color-ink-muted)]">{formatDate(entry.day)}</td>
                  <td className="py-0.5 text-right text-[var(--color-ink)]">{formatNumber(entry.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
