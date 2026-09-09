import 'server-only';
import { MetricType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Datenschutzfreundliche Website-Statistik.
 *
 * Es werden ausschliesslich tagesweise aggregierte Zähler gespeichert – keine
 * IP-Adressen, keine Cookies, keine Profilbildung, keine externen Dienste.
 * Aus den Daten lässt sich keine einzelne Person ableiten.
 */

export { MetricType };

/** Tagesgrenze in UTC – die Auswertung erfolgt tagesgenau, nicht sekundengenau. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Begrenzt die Kardinalität: unbekannte Schlüssel werden verworfen. */
export function normaliseMetricKey(type: MetricType, key: string): string | null {
  const value = key.trim().slice(0, 160);
  if (value.length === 0) return null;

  if (type === MetricType.PAGE_VIEW || type === MetricType.TOURNAMENT_VIEW) {
    if (!value.startsWith('/')) return null;
    if (value.startsWith('/admin')) return null;
    // Query-Strings und Fragmente gehören nicht in die Statistik.
    return value.split(/[?#]/)[0]?.slice(0, 160) ?? null;
  }

  if (type === MetricType.SOCIAL_CLICK) {
    const allowed = ['DISCORD', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITCH', 'OTHER'];
    return allowed.includes(value.toUpperCase()) ? value.toUpperCase() : null;
  }

  return value;
}

export async function recordMetric(type: MetricType, key: string, amount = 1): Promise<void> {
  if (!env().METRICS_ENABLED) return;

  const normalised = normaliseMetricKey(type, key);
  if (!normalised) return;

  const day = today();

  try {
    await prisma.siteMetric.upsert({
      where: { day_type_key: { day, type, key: normalised } },
      create: { day, type, key: normalised, count: amount },
      update: { count: { increment: amount } },
    });
  } catch (error) {
    // Statistik darf niemals einen Seitenaufruf stören.
    console.error('Kennzahl konnte nicht gespeichert werden:', error);
  }
}

export type MetricRange = { from: Date; to: Date };

export function lastDays(days: number): MetricRange {
  const to = today();
  const from = new Date(to.getTime() - (days - 1) * 24 * 3600 * 1000);
  return { from, to };
}

export async function totalsByType(range: MetricRange): Promise<Record<MetricType, number>> {
  const rows = await prisma.siteMetric.groupBy({
    by: ['type'],
    where: { day: { gte: range.from, lte: range.to } },
    _sum: { count: true },
  });

  const totals = Object.fromEntries(
    Object.values(MetricType).map((type) => [type, 0]),
  ) as Record<MetricType, number>;

  for (const row of rows) {
    totals[row.type] = row._sum.count ?? 0;
  }
  return totals;
}

export async function topKeys(
  type: MetricType,
  range: MetricRange,
  limit = 8,
): Promise<{ key: string; count: number }[]> {
  const rows = await prisma.siteMetric.groupBy({
    by: ['key'],
    where: { type, day: { gte: range.from, lte: range.to } },
    _sum: { count: true },
    orderBy: { _sum: { count: 'desc' } },
    take: limit,
  });

  return rows.map((row) => ({ key: row.key, count: row._sum.count ?? 0 }));
}

/** Tagesreihe für die Verlaufsdarstellung; fehlende Tage werden mit 0 aufgefüllt. */
export async function dailySeries(type: MetricType, range: MetricRange): Promise<{ day: Date; count: number }[]> {
  const rows = await prisma.siteMetric.groupBy({
    by: ['day'],
    where: { type, day: { gte: range.from, lte: range.to } },
    _sum: { count: true },
  });

  const map = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row._sum.count ?? 0]));
  const series: { day: Date; count: number }[] = [];

  for (let time = range.from.getTime(); time <= range.to.getTime(); time += 24 * 3600 * 1000) {
    const day = new Date(time);
    series.push({ day, count: map.get(day.toISOString().slice(0, 10)) ?? 0 });
  }

  return series;
}
