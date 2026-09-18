import { describe, expect, it } from 'vitest';
import {
  containsHost,
  excerptAround,
  parseTarget,
  rewriteJson,
  rewriteText,
  type DomainRewrite,
} from '@/lib/domainRewrite';

/**
 * Beim Domainwechsel darf genau eine Sache passieren: Adressen der alten
 * Domain zeigen danach auf die neue. Alles andere – andere Subdomains, fremde
 * Adressen, Pfade, Postfächer – muss unverändert bleiben. Geprüft wird deshalb
 * vor allem, was **nicht** angefasst werden darf.
 */

const wechsel: DomainRewrite = { fromHost: 'new.swisshub.gg', toOrigin: 'https://swisshub.gg' };

describe('Adressen umschreiben', () => {
  it('ersetzt vollständige Adressen und behält Pfad, Parameter und Sprungmarke', () => {
    expect(rewriteText('https://new.swisshub.gg/turniere?status=laufend#liste', wechsel)).toBe(
      'https://swisshub.gg/turniere?status=laufend#liste',
    );
  });

  it('hebt unverschlüsselte und protokollrelative Adressen auf https an', () => {
    expect(rewriteText('http://new.swisshub.gg/partner', wechsel)).toBe('https://swisshub.gg/partner');
    expect(rewriteText('//new.swisshub.gg/partner', wechsel)).toBe('https://swisshub.gg/partner');
  });

  it('ersetzt eine blosse Nennung im Fliesstext ohne Protokoll zu erfinden', () => {
    expect(rewriteText('Mehr dazu auf new.swisshub.gg, wie gewohnt.', wechsel)).toBe(
      'Mehr dazu auf swisshub.gg, wie gewohnt.',
    );
  });

  it('schreibt jedes Vorkommen um, auch mehrere in einem Text', () => {
    expect(rewriteText('[A](https://new.swisshub.gg/a) und [B](https://new.swisshub.gg/b)', wechsel)).toBe(
      '[A](https://swisshub.gg/a) und [B](https://swisshub.gg/b)',
    );
  });

  it('ist mehrfach anwendbar – ein zweiter Lauf ändert nichts', () => {
    const einmal = rewriteText('https://new.swisshub.gg/kontakt', wechsel);
    expect(rewriteText(einmal, wechsel)).toBe(einmal);
  });
});

describe('Was unberührt bleibt', () => {
  it('lässt andere SwissHub-Subdomains stehen', () => {
    for (const adresse of [
      'https://system.swisshub.gg/status',
      'https://sponsoring.swisshub.gg',
      'https://swisshub.gg/turniere',
      'https://www.swisshub.gg',
    ]) {
      expect(rewriteText(adresse, wechsel), adresse).toBe(adresse);
    }
  });

  it('lässt Hosts stehen, die den alten Namen nur enthalten', () => {
    for (const adresse of [
      'https://alt-new.swisshub.gg',
      'https://system.new.swisshub.gg',
      'https://new.swisshub.gg.example.com/uebernahme',
    ]) {
      expect(rewriteText(adresse, wechsel), adresse).toBe(adresse);
    }
  });

  it('lässt E-Mail-Adressen unverändert', () => {
    // Ein Postfachwechsel ist eine eigene Entscheidung, keine Folge des
    // Domainwechsels der Website.
    expect(rewriteText('info@new.swisshub.gg', wechsel)).toBe('info@new.swisshub.gg');
  });

  it('lässt fremde Adressen und Pfadangaben unverändert', () => {
    expect(rewriteText('https://discord.gg/beispiel', wechsel)).toBe('https://discord.gg/beispiel');
    expect(rewriteText('/archiv/new.swisshub.gg/alt.html', wechsel)).toBe('/archiv/new.swisshub.gg/alt.html');
  });
});

describe('JSON-Inhalte', () => {
  it('ersetzt nur Zeichenketten in den Werten', () => {
    const vorher = {
      headline: 'Zur alten Adresse',
      link: { href: 'https://new.swisshub.gg/turniere', external: true },
      cards: [{ text: 'siehe new.swisshub.gg' }, { text: 'siehe system.swisshub.gg' }],
      columns: 4,
      backgroundMediaId: null,
    };

    expect(rewriteJson(vorher, wechsel)).toEqual({
      headline: 'Zur alten Adresse',
      link: { href: 'https://swisshub.gg/turniere', external: true },
      cards: [{ text: 'siehe swisshub.gg' }, { text: 'siehe system.swisshub.gg' }],
      columns: 4,
      backgroundMediaId: null,
    });
  });

  it('lässt Schlüsselnamen unberührt', () => {
    expect(rewriteJson({ 'new.swisshub.gg': 'x' }, wechsel)).toEqual({ 'new.swisshub.gg': 'x' });
  });
});

describe('Erkennen und Vorschau', () => {
  it('erkennt nur echte Vorkommen', () => {
    expect(containsHost('https://new.swisshub.gg/a', 'new.swisshub.gg')).toBe(true);
    expect(containsHost('new.swisshub.gg', 'new.swisshub.gg')).toBe(true);
    expect(containsHost('https://system.swisshub.gg', 'new.swisshub.gg')).toBe(false);
  });

  it('zeigt einen Ausschnitt um die erste Fundstelle', () => {
    const text = `${'x'.repeat(200)} https://new.swisshub.gg/kontakt ${'y'.repeat(200)}`;
    const ausschnitt = excerptAround(text, 'new.swisshub.gg');

    expect(ausschnitt).toContain('new.swisshub.gg/kontakt');
    expect(ausschnitt?.length).toBeLessThan(120);
  });

  it('meldet nichts, wenn es nichts zu zeigen gibt', () => {
    expect(excerptAround('nur text', 'new.swisshub.gg')).toBeNull();
  });
});

describe('Angabe der Domain', () => {
  it('nimmt beide Schreibweisen an', () => {
    expect(parseTarget('swisshub.gg')).toEqual({ host: 'swisshub.gg', origin: 'https://swisshub.gg' });
    expect(parseTarget('https://swisshub.gg/')).toEqual({ host: 'swisshub.gg', origin: 'https://swisshub.gg' });
  });

  it('lehnt eine Angabe mit Pfad ab', () => {
    expect(() => parseTarget('https://swisshub.gg/start')).toThrow(/Pfad/);
    expect(() => parseTarget('   ')).toThrow();
  });
});
