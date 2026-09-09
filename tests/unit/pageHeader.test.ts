import { describe, expect, it } from 'vitest';
import { splitPageHeader } from '@/lib/content/pageHeader';
import { parseSections } from '@/lib/content/sections';

/**
 * Jede CMS-Seite bekommt denselben Kopfbereich – auch eine, die im
 * Website-Builder gerade erst angelegt wurde. Dabei darf kein gepflegter
 * Inhalt verloren gehen und nichts erfunden werden.
 */

function sections(...raw: { id: string; type: string; visible?: boolean; data: unknown }[]) {
  return parseSections(
    raw.map((section) => ({
      id: section.id,
      type: section.type as Parameters<typeof parseSections>[0][number]['type'],
      visible: section.visible ?? true,
      data: section.data,
    })),
  );
}

describe('Kopfbereich einer CMS-Seite', () => {
  it('übernimmt die Angaben des Auftaktblocks und gibt ihn nicht doppelt aus', () => {
    const parsed = sections(
      {
        id: 'a',
        type: 'HERO',
        data: {
          eyebrow: 'Über SwissHub',
          headline: 'Ein Verein, eine Community',
          motto: 'Zäme hock, zäme zocke',
          text: 'Kurze Einleitung.',
          primaryLink: { label: 'Discord beitreten', href: '{discord}', style: 'primary', external: true },
        },
      },
      { id: 'b', type: 'RICH_TEXT', data: { headline: 'Verlauf', markdown: 'Text' } },
    );

    const { header, sections: rest } = splitPageHeader(parsed, 'Über uns');

    expect(header.eyebrow).toBe('Über SwissHub');
    expect(header.title).toBe('Ein Verein, eine Community');
    expect(header.lead).toBe('Kurze Einleitung.');
    // Motto und Schaltfläche gehen nicht verloren.
    expect(header.motto).toBe('Zäme hock, zäme zocke');
    expect(header.primaryLink?.label).toBe('Discord beitreten');

    expect(rest.map((section) => section.id)).toEqual(['b']);
  });

  it('kommt ohne Auftaktblock mit dem Seitentitel aus', () => {
    const parsed = sections({ id: 'a', type: 'RICH_TEXT', data: { headline: 'Impressum', markdown: 'Text' } });
    const { header, sections: rest } = splitPageHeader(parsed, 'Impressum');

    expect(header.title).toBe('Impressum');
    // Nichts erfunden: kein Label, keine Einleitung, keine Schaltfläche.
    expect(header.eyebrow).toBe('');
    expect(header.lead).toBe('');
    expect(header.primaryLink).toBeNull();
    // Der Inhalt bleibt vollständig erhalten.
    expect(rest.map((section) => section.id)).toEqual(['a']);
  });

  it('funktioniert für eine Seite ganz ohne Abschnitte', () => {
    const { header, sections: rest } = splitPageHeader([], 'Neue Seite');

    expect(header.title).toBe('Neue Seite');
    expect(rest).toEqual([]);
  });

  it('fällt bei leeren Angaben auf den Seitentitel zurück', () => {
    // Eine Hauptaussage aus reinen Leerzeichen ergibt keine Überschrift.
    const { header } = splitPageHeader(
      sections({ id: 'a', type: 'HERO', data: { headline: '   ', eyebrow: '  ', text: ' ' } }),
      'Seitentitel',
    );

    expect(header.title).toBe('Seitentitel');
    expect(header.eyebrow).toBe('');
    expect(header.lead).toBe('');
  });

  it('greift nur auf den ersten sichtbaren Block zu', () => {
    const parsed = sections(
      { id: 'a', type: 'HERO', visible: false, data: { headline: 'Ausgeblendet' } },
      { id: 'b', type: 'HERO', data: { headline: 'Sichtbar' } },
      { id: 'c', type: 'TEXT', data: { text: 'Inhalt' } },
    );

    const { header, sections: rest } = splitPageHeader(parsed, 'Seite');

    expect(header.title).toBe('Sichtbar');
    expect(rest.map((section) => section.id)).toEqual(['a', 'c']);
  });

  it('lässt einen Auftaktblock stehen, der nicht zuoberst liegt', () => {
    const parsed = sections(
      { id: 'a', type: 'TEXT', data: { text: 'Inhalt' } },
      { id: 'b', type: 'HERO', data: { headline: 'Weiter unten' } },
    );

    const { header, sections: rest } = splitPageHeader(parsed, 'Seite');

    expect(header.title).toBe('Seite');
    expect(rest.map((section) => section.id)).toEqual(['a', 'b']);
  });
});
