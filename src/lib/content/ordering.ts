import { TournamentStatus } from '@prisma/client';

/**
 * Reihenfolge öffentlicher Listen.
 *
 * Die Regeln stehen an dieser einen Stelle, damit Übersicht, Inhaltsblöcke und
 * gefilterte Ansichten dieselbe Reihenfolge zeigen. Sortiert wird bewusst in
 * der Anwendung und nicht in der Datenbank: Die Vorrangregel für Turniere
 * („Anmeldungen offen“ zuerst) lässt sich in einem `ORDER BY` nicht ohne
 * Rohabfrage ausdrücken, und die Listen sind klein.
 *
 * Beide Vergleiche sind **total**: Bei gleichen oder fehlenden Datumswerten
 * entscheidet zuletzt die unveränderliche Kennung. Dadurch ist die Reihenfolge
 * bei jedem Aufruf dieselbe – auch über Filter und Seitenaufteilung hinweg.
 */

/** Zeitwert eines Datums; fehlende Angaben landen immer am Ende. */
function time(value: Date | null | undefined): number {
  return value ? value.getTime() : Number.NEGATIVE_INFINITY;
}

/**
 * Neuere zuerst.
 *
 * Bewusst über einen Vergleich statt über eine Subtraktion: Fehlen **beide**
 * Angaben, ergäbe `-Infinity - (-Infinity)` den Wert `NaN`. Eine
 * Vergleichsfunktion, die `NaN` liefert, hebt die Ordnung auf – die Reihenfolge
 * wäre dann von der Eingabereihenfolge abhängig und damit nicht mehr stabil.
 */
function byNewest(a: Date | null | undefined, b: Date | null | undefined): number {
  const ta = time(a);
  const tb = time(b);
  if (ta === tb) return 0;
  return ta > tb ? -1 : 1;
}

type SortableTournament = {
  id: string;
  status: TournamentStatus;
  startsAt: Date | null;
  publishedAt?: Date | null;
};

type SortablePost = {
  id: string;
  postedAt: Date | null;
  publishedAt?: Date | null;
};

/**
 * Turniere: Offene Anmeldungen zuerst, danach alle übrigen – jeweils die
 * aktuellsten zuoberst.
 *
 * Als Datum gilt der Turniertermin; fehlt er, entscheidet die
 * Veröffentlichung. So steht ein Turnier ohne Termin nicht willkürlich oben.
 */
export function compareTournaments(a: SortableTournament, b: SortableTournament): number {
  const aOpen = a.status === TournamentStatus.REGISTRATION_OPEN;
  const bOpen = b.status === TournamentStatus.REGISTRATION_OPEN;
  if (aOpen !== bOpen) return aOpen ? -1 : 1;

  const byStart = byNewest(a.startsAt, b.startsAt);
  if (byStart !== 0) return byStart;

  const byPublished = byNewest(a.publishedAt, b.publishedAt);
  if (byPublished !== 0) return byPublished;

  return a.id.localeCompare(b.id);
}

/**
 * Beiträge: ausschliesslich nach Veröffentlichungsdatum, die aktuellsten oben.
 *
 * Die Vorrangregel der Turniere gilt hier nicht – Beiträge haben keinen
 * Anmeldestatus. Massgeblich ist der Zeitpunkt auf der Plattform; fehlt er,
 * entscheidet die Freigabe auf der Website.
 */
export function comparePosts(a: SortablePost, b: SortablePost): number {
  const byPosted = byNewest(a.postedAt, b.postedAt);
  if (byPosted !== 0) return byPosted;

  const byPublished = byNewest(a.publishedAt, b.publishedAt);
  if (byPublished !== 0) return byPublished;

  return a.id.localeCompare(b.id);
}

/** Sortiert eine Liste, ohne die übergebene zu verändern. */
export function sortTournaments<T extends SortableTournament>(items: T[]): T[] {
  return [...items].sort(compareTournaments);
}

export function sortPosts<T extends SortablePost>(items: T[]): T[] {
  return [...items].sort(comparePosts);
}
