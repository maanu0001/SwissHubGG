import { describe, expect, it } from 'vitest';
import { introState, shouldPlayIntro } from '@/lib/motion/intro';

/**
 * Die Einfluganimation ist ein Auftritt beim Wechsel von der Startseite in
 * einen Bereich – und sonst nichts. Geprüft wird deshalb vor allem, dass sie in
 * allen anderen Fällen wirklich ausbleibt.
 */

describe('Einfluganimation: Wechsel von der Startseite', () => {
  const subpages = ['/ueber-uns', '/turniere', '/partner', '/social', '/kontakt'];

  it('spielt beim direkten Wechsel von der Startseite auf eine Unterseite', () => {
    for (const to of subpages) {
      expect(shouldPlayIntro({ from: '/', to }), `Startseite → ${to}`).toBe(true);
    }
  });

  it('spielt auch für eine neu angelegte CMS-Seite', () => {
    expect(shouldPlayIntro({ from: '/', to: '/neue-seite' })).toBe(true);
  });

  it('lässt die Startseite selbst unverändert', () => {
    expect(shouldPlayIntro({ from: '/turniere', to: '/' })).toBe(true);
    // Erstaufruf der Startseite: sie beginnt immer mit ihrem eigenen Auftritt.
    expect(shouldPlayIntro({ from: null, to: '/' })).toBe(true);
  });
});

describe('Einfluganimation: alles andere bleibt ruhig', () => {
  it('bleibt beim Wechsel zwischen Unterseiten aus', () => {
    const steps: [string, string][] = [
      ['/ueber-uns', '/turniere'],
      ['/turniere', '/partner'],
      ['/partner', '/social'],
      ['/social', '/kontakt'],
      ['/kontakt', '/ueber-uns'],
    ];

    for (const [from, to] of steps) {
      expect(shouldPlayIntro({ from, to }), `${from} → ${to}`).toBe(false);
    }
  });

  it('bleibt ohne bekannte Vorgängerroute aus', () => {
    // Direktaufruf, Neuladen, neuer Tab, Verweis von aussen.
    expect(shouldPlayIntro({ from: null, to: '/turniere' })).toBe(false);
  });

  it('bleibt in der Vorschau und im Dashboard aus', () => {
    expect(shouldPlayIntro({ from: null, to: '/vorschau/abc' })).toBe(false);
    expect(shouldPlayIntro({ from: '/admin/seiten', to: '/vorschau/abc' })).toBe(false);
    expect(shouldPlayIntro({ from: null, to: '/admin' })).toBe(false);
  });

  it('genügt sich nicht mit einem früheren Besuch der Startseite', () => {
    // /  →  /turniere  →  /partner: entscheidend ist allein der letzte Schritt.
    expect(shouldPlayIntro({ from: '/turniere', to: '/partner' })).toBe(false);
  });

  it('unterscheidet die Startseite von einer Unterseite mit ähnlichem Pfad', () => {
    expect(shouldPlayIntro({ from: '/home', to: '/turniere' })).toBe(false);
    expect(shouldPlayIntro({ from: '/start', to: '/turniere' })).toBe(false);
  });

  it('gibt reduzierter Bewegung immer den Vorrang', () => {
    expect(shouldPlayIntro({ from: '/', to: '/turniere', reducedMotion: true })).toBe(false);
    expect(shouldPlayIntro({ from: '/turniere', to: '/', reducedMotion: true })).toBe(false);
  });
});

describe('Zustand für das CSS', () => {
  it('liefert genau die beiden Werte, die das Stylesheet kennt', () => {
    expect(introState({ from: '/', to: '/turniere' })).toBe('on');
    expect(introState({ from: '/turniere', to: '/partner' })).toBe('off');
  });
});
