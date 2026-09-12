import { describe, expect, it } from 'vitest';
import { TournamentStatus } from '@prisma/client';
import { comparePosts, compareTournaments, sortPosts, sortTournaments } from '@/lib/content/ordering';

/**
 * Reihenfolge öffentlicher Listen.
 *
 * Für Turniere gilt eine Vorrangregel („Anmeldungen offen“ zuerst), für
 * Beiträge ausdrücklich nicht. Beide Vergleiche müssen total sein, damit die
 * Reihenfolge über Filter und Seitenaufteilung hinweg stabil bleibt.
 */

const tag = 86_400_000;
const jetzt = Date.UTC(2026, 8, 12);
const am = (versatz: number) => new Date(jetzt + versatz * tag);

function turnier(
  id: string,
  status: TournamentStatus,
  startsAt: Date | null,
  publishedAt: Date | null = am(-100),
) {
  return { id, status, startsAt, publishedAt };
}

describe('Turniere', () => {
  it('stellt offene Anmeldungen vor alle anderen – unabhängig vom Datum', () => {
    const spaeteresAnderes = turnier('a', TournamentStatus.ANNOUNCED, am(90));
    const aelteresOffen = turnier('b', TournamentStatus.REGISTRATION_OPEN, am(-30));

    expect(compareTournaments(aelteresOffen, spaeteresAnderes)).toBeLessThan(0);
    expect(compareTournaments(spaeteresAnderes, aelteresOffen)).toBeGreaterThan(0);
  });

  it('zeigt innerhalb der offenen Anmeldungen die aktuellsten zuerst', () => {
    const sortiert = sortTournaments([
      turnier('alt', TournamentStatus.REGISTRATION_OPEN, am(5)),
      turnier('neu', TournamentStatus.REGISTRATION_OPEN, am(40)),
      turnier('mitte', TournamentStatus.REGISTRATION_OPEN, am(20)),
    ]);

    expect(sortiert.map((t) => t.id)).toEqual(['neu', 'mitte', 'alt']);
  });

  it('sortiert die übrigen Turniere nach Datum absteigend', () => {
    const sortiert = sortTournaments([
      turnier('vergangen', TournamentStatus.COMPLETED, am(-60)),
      turnier('laufend', TournamentStatus.RUNNING, am(-1)),
      turnier('angekuendigt', TournamentStatus.ANNOUNCED, am(30)),
    ]);

    expect(sortiert.map((t) => t.id)).toEqual(['angekuendigt', 'laufend', 'vergangen']);
  });

  it('stellt Turniere ohne Termin ans Ende ihrer Gruppe', () => {
    const sortiert = sortTournaments([
      turnier('ohne', TournamentStatus.ANNOUNCED, null),
      turnier('mit', TournamentStatus.ANNOUNCED, am(-400)),
    ]);

    expect(sortiert.map((t) => t.id)).toEqual(['mit', 'ohne']);
  });

  it('entscheidet bei gleichem Datum über die Veröffentlichung', () => {
    const sortiert = sortTournaments([
      turnier('frueher', TournamentStatus.ANNOUNCED, am(10), am(-10)),
      turnier('spaeter', TournamentStatus.ANNOUNCED, am(10), am(-2)),
    ]);

    expect(sortiert.map((t) => t.id)).toEqual(['spaeter', 'frueher']);
  });

  it('bleibt bei völlig gleichen Angaben stabil', () => {
    const gleich = [
      turnier('c', TournamentStatus.ANNOUNCED, null, null),
      turnier('a', TournamentStatus.ANNOUNCED, null, null),
      turnier('b', TournamentStatus.ANNOUNCED, null, null),
    ];

    expect(sortTournaments(gleich).map((t) => t.id)).toEqual(['a', 'b', 'c']);
    // Mehrfaches Sortieren ändert nichts mehr.
    expect(sortTournaments(sortTournaments(gleich)).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('verändert die übergebene Liste nicht', () => {
    const original = [
      turnier('a', TournamentStatus.COMPLETED, am(-10)),
      turnier('b', TournamentStatus.REGISTRATION_OPEN, am(-20)),
    ];
    const kopie = [...original];
    sortTournaments(original);

    expect(original).toEqual(kopie);
  });
});

describe('Beiträge', () => {
  const post = (id: string, postedAt: Date | null, publishedAt: Date | null = null) => ({ id, postedAt, publishedAt });

  it('sortiert ausschliesslich nach Datum, die aktuellsten oben', () => {
    const sortiert = sortPosts([post('alt', am(-30)), post('neu', am(-1)), post('mittel', am(-10))]);
    expect(sortiert.map((p) => p.id)).toEqual(['neu', 'mittel', 'alt']);
  });

  it('kennt keine Vorrangregel – ein Anmeldestatus existiert hier nicht', () => {
    // Beiträge tragen kein Statusfeld; der Vergleich sieht nur Datum und Kennung.
    const a = post('a', am(-1));
    const b = post('b', am(-2));
    expect(comparePosts(a, b)).toBeLessThan(0);
  });

  it('weicht auf die Freigabe aus, wenn der Plattformzeitpunkt fehlt', () => {
    const sortiert = sortPosts([post('ohne', null, am(-1)), post('mit', am(-40))]);
    // Ein gepflegter Plattformzeitpunkt hat Vorrang vor einem fehlenden.
    expect(sortiert.map((p) => p.id)).toEqual(['mit', 'ohne']);
  });

  it('bleibt bei gleichem Datum stabil', () => {
    const sortiert = sortPosts([post('c', am(-5)), post('a', am(-5)), post('b', am(-5))]);
    expect(sortiert.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
