import { describe, expect, it } from 'vitest';
import {
  SECTION_SCHEMAS,
  collectLinks,
  collectMediaIds,
  defaultSectionData,
  parseSection,
  parseSections,
} from '@/lib/content/sections';
import { SECTION_FIELDS } from '@/lib/content/sectionFields';
import { SECTION_META } from '@/lib/content/sections';

/** Der Website-Builder darf nur Werte zulassen, die das Designsystem vorsieht. */
describe('Abschnittsdefinitionen', () => {
  it('hat für jeden Typ ein Schema, Felder und Beschreibungstexte', () => {
    const types = Object.keys(SECTION_SCHEMAS);
    expect(types.length).toBe(17);

    for (const type of types) {
      expect(SECTION_FIELDS[type as keyof typeof SECTION_FIELDS], `Felder fehlen für ${type}`).toBeDefined();
      expect(SECTION_META[type as keyof typeof SECTION_META], `Beschreibung fehlt für ${type}`).toBeDefined();
    }
  });

  it('erzeugt für jeden Typ gültige Standardwerte', () => {
    for (const type of Object.keys(SECTION_SCHEMAS)) {
      const data = defaultSectionData(type as keyof typeof SECTION_SCHEMAS);
      expect(data, `Standardwerte fehlen für ${type}`).toBeDefined();
    }
  });
});

describe('parseSection', () => {
  it('akzeptiert gültige Daten', () => {
    const section = parseSection({
      id: 's1',
      type: 'HERO',
      visible: true,
      data: { headline: 'Willkommen' },
    });

    expect(section).not.toBeNull();
    expect(section?.type).toBe('HERO');
  });

  it('verwirft unvollständige Abschnitte statt die Seite abstürzen zu lassen', () => {
    // HERO benötigt zwingend eine Überschrift.
    expect(parseSection({ id: 's1', type: 'HERO', visible: true, data: {} })).toBeNull();
  });

  it('lehnt unerlaubte Werte ab', () => {
    const section = parseSection({
      id: 's1',
      type: 'TEXT',
      visible: true,
      data: { text: 'Hallo', tone: 'neon-pink' },
    });

    expect(section).toBeNull();
  });

  it('überspringt ungültige Abschnitte in einer Liste', () => {
    const sections = parseSections([
      { id: 'a', type: 'TEXT', visible: true, data: { text: 'Gültig' } },
      { id: 'b', type: 'HERO', visible: true, data: {} },
      { id: 'c', type: 'SPACER', visible: true, data: {} },
    ]);

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.id)).toEqual(['a', 'c']);
  });
});

describe('collectMediaIds', () => {
  it('sammelt Medien aus allen relevanten Blöcken', () => {
    const sections = parseSections([
      { id: 'a', type: 'IMAGE', visible: true, data: { mediaId: 'm1' } },
      { id: 'b', type: 'GALLERY', visible: true, data: { items: [{ mediaId: 'm2' }, { mediaId: 'm3' }] } },
      { id: 'c', type: 'HERO', visible: true, data: { headline: 'Titel', backgroundMediaId: 'm4' } },
    ]);

    expect(collectMediaIds(sections).sort()).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});

describe('collectLinks', () => {
  it('sammelt Links aus Hero, CTA und Karten', () => {
    const sections = parseSections([
      {
        id: 'a',
        type: 'CTA',
        visible: true,
        data: {
          headline: 'Mach mit',
          primaryLink: { label: 'Discord', href: 'https://discord.gg/beispiel' },
        },
      },
      {
        id: 'b',
        type: 'CARD_GRID',
        visible: true,
        data: {
          cards: [{ title: 'Karte', link: { label: 'Mehr', href: '/turniere' } }],
        },
      },
    ]);

    const links = collectLinks(sections);
    expect(links.map((link) => link.href).sort()).toEqual(['/turniere', 'https://discord.gg/beispiel']);
  });
});
