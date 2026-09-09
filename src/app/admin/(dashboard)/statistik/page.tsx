import Link from 'next/link';
import { MetricType } from '@prisma/client';
import { PageHeader, Panel, StatCard, InfoBox, DataTable, EmptyRow } from '@/components/admin/ui';
import { MetricSparkline } from '@/components/admin/MetricSparkline';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions';
import { dailySeries, lastDays, topKeys, totalsByType } from '@/lib/metrics';
import { env } from '@/lib/env';
import { formatNumber } from '@/lib/format';

export const metadata = { title: 'Statistik' };

type PageProps = { searchParams: Promise<{ zeitraum?: string }> };

const RANGES = [
  { key: '7', label: '7 Tage' },
  { key: '30', label: '30 Tage' },
  { key: '90', label: '90 Tage' },
] as const;

/** Datenschutzfreundliche Website-Statistik auf Basis eigener, aggregierter Daten. */
export default async function AdminStatisticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  await requirePermission(PERMISSIONS.METRICS_VIEW);

  const days = RANGES.some((range) => range.key === params.zeitraum) ? Number(params.zeitraum) : 30;
  const range = lastDays(days);

  if (!env().METRICS_ENABLED) {
    return (
      <>
        <PageHeader title="Statistik" />
        <Panel>
          <InfoBox tone="info" title="Statistik ist deaktiviert">
            Setze <code>METRICS_ENABLED=true</code> in der Umgebung, um anonyme Nutzungszahlen zu erheben.
          </InfoBox>
        </Panel>
      </>
    );
  }

  const [totals, pages, tournaments, socials, sponsors, categories, series] = await Promise.all([
    totalsByType(range),
    topKeys(MetricType.PAGE_VIEW, range, 10),
    topKeys(MetricType.TOURNAMENT_VIEW, range, 10),
    topKeys(MetricType.SOCIAL_CLICK, range, 8),
    topKeys(MetricType.SPONSOR_CLICK, range, 8),
    topKeys(MetricType.CONTACT_SUBMISSION, range, 8),
    dailySeries(MetricType.PAGE_VIEW, range),
  ]);

  return (
    <>
      <PageHeader
        title="Statistik"
        description={`Anonyme, tagesweise aggregierte Zahlen der letzten ${days} Tage.`}
        actions={
          <nav aria-label="Zeitraum" className="flex gap-1 rounded-lg border border-[var(--color-line)] p-1">
            {RANGES.map((option) => (
              <Link
                key={option.key}
                href={`/admin/statistik?zeitraum=${option.key}`}
                aria-current={String(days) === option.key ? 'true' : undefined}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  String(days) === option.key
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                }`}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="space-y-6">
        <InfoBox tone="info" title="Was hier gemessen wird">
          Es werden ausschliesslich Tagessummen pro Seite bzw. Ziel gespeichert – ohne Cookies, ohne IP-Adressen und
          ohne externe Dienste. Eine Zuordnung zu einzelnen Personen ist nicht möglich, Besucherzahlen im Sinne von
          „eindeutigen Nutzern“ werden deshalb bewusst nicht ausgewiesen.
        </InfoBox>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Seitenaufrufe" value={formatNumber(totals.PAGE_VIEW)} />
          <StatCard label="Turnier-Detailaufrufe" value={formatNumber(totals.TOURNAMENT_VIEW)} />
          <StatCard label="Discord-Klicks" value={formatNumber(totals.DISCORD_CLICK)} />
          <StatCard label="Kontaktanfragen" value={formatNumber(totals.CONTACT_SUBMISSION)} />
        </div>

        <Panel title="Zeitlicher Verlauf">
          <MetricSparkline series={series} label="Seitenaufrufe pro Tag" />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Beliebte Seiten">
            <DataTable headers={['Seite', 'Aufrufe']}>
              {pages.length === 0 ? (
                <EmptyRow message="Für diesen Zeitraum liegen keine Daten vor." colSpan={2} />
              ) : (
                pages.map((entry) => (
                  <tr key={entry.key}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-xs text-[var(--color-ink-muted)]">
                      {entry.key}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right text-[var(--color-ink)]">
                      {formatNumber(entry.count)}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>

          <Panel title="Turnierseiten">
            <DataTable headers={['Turnier', 'Aufrufe']}>
              {tournaments.length === 0 ? (
                <EmptyRow message="Für diesen Zeitraum liegen keine Daten vor." colSpan={2} />
              ) : (
                tournaments.map((entry) => (
                  <tr key={entry.key}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 font-mono text-xs text-[var(--color-ink-muted)]">
                      {entry.key}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right text-[var(--color-ink)]">
                      {formatNumber(entry.count)}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>

          <Panel title="Klicks auf Social-Media-Profile">
            <DataTable headers={['Plattform', 'Klicks']}>
              {socials.length === 0 ? (
                <EmptyRow message="Für diesen Zeitraum liegen keine Daten vor." colSpan={2} />
              ) : (
                socials.map((entry) => (
                  <tr key={entry.key}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-[var(--color-ink-muted)]">
                      {entry.key}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right text-[var(--color-ink)]">
                      {formatNumber(entry.count)}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>

          <Panel title="Klicks auf Sponsoren">
            <DataTable headers={['Partner', 'Klicks']}>
              {sponsors.length === 0 ? (
                <EmptyRow message="Für diesen Zeitraum liegen keine Daten vor." colSpan={2} />
              ) : (
                sponsors.map((entry) => (
                  <tr key={entry.key}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-[var(--color-ink-muted)]">
                      {entry.key}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right text-[var(--color-ink)]">
                      {formatNumber(entry.count)}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>

          <Panel title="Kontaktanfragen nach Kategorie" className="lg:col-span-2">
            <DataTable headers={['Kategorie', 'Anfragen']}>
              {categories.length === 0 ? (
                <EmptyRow message="Für diesen Zeitraum liegen keine Daten vor." colSpan={2} />
              ) : (
                categories.map((entry) => (
                  <tr key={entry.key}>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-[var(--color-ink-muted)]">
                      {entry.key}
                    </td>
                    <td className="border-b border-[var(--color-line)] px-4 py-2.5 text-right text-[var(--color-ink)]">
                      {formatNumber(entry.count)}
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>
        </div>
      </div>
    </>
  );
}
