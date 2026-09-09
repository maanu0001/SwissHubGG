import { z } from 'zod';
import type { SectionType } from '@prisma/client';

/**
 * Definition aller Inhaltselemente des Website-Builders.
 *
 * Jeder Block hat ein Zod-Schema. Damit gilt:
 *  - Die Redaktion kann nur gültige, im Designsystem vorgesehene Werte setzen.
 *  - Freie Stil- oder HTML-Eingaben sind nicht möglich; das Markenbild bleibt intakt.
 *  - Der öffentliche Renderer kann sich auf die Struktur verlassen.
 */

const linkSchema = z.object({
  label: z.string().min(1, 'Bitte gib eine Beschriftung an.').max(60),
  href: z.string().min(1, 'Bitte gib ein Ziel an.').max(300),
  style: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
  external: z.boolean().default(false),
});

export type SectionLink = z.infer<typeof linkSchema>;

const mediaRefSchema = z.object({
  mediaId: z.string().min(1),
  caption: z.string().max(200).optional().default(''),
});

/**
 * Erlaubte Hintergrundvarianten – bewusst begrenzt auf das Designsystem.
 * „tech“ ist die dunkle, technische Fläche mit feinem Raster.
 */
const toneSchema = z.enum(['default', 'muted', 'accent', 'tech']).default('default');

export const heroSchema = z.object({
  eyebrow: z.string().max(60).default(''),
  headline: z.string().min(1, 'Bitte gib eine Hauptaussage an.').max(120),
  motto: z.string().max(80).default(''),
  text: z.string().max(600).default(''),
  primaryLink: linkSchema.nullable().default(null),
  secondaryLink: linkSchema.nullable().default(null),
  backgroundMediaId: z.string().nullable().default(null),
  showLogo: z.boolean().default(true),
});

export const textSchema = z.object({
  eyebrow: z.string().max(60).default(''),
  headline: z.string().max(120).default(''),
  text: z.string().max(4000).default(''),
  align: z.enum(['left', 'center']).default('left'),
  tone: toneSchema,
});

export const richTextSchema = z.object({
  headline: z.string().max(120).default(''),
  markdown: z.string().max(20000).default(''),
  tone: toneSchema,
});

export const imageSchema = z.object({
  mediaId: z.string().min(1, 'Bitte wähle ein Bild aus der Medienbibliothek.'),
  caption: z.string().max(200).default(''),
  width: z.enum(['content', 'wide']).default('content'),
  rounded: z.boolean().default(true),
});

export const gallerySchema = z.object({
  headline: z.string().max(120).default(''),
  items: z.array(mediaRefSchema).max(24).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
});

export const videoSchema = z.object({
  headline: z.string().max(120).default(''),
  url: z.string().min(1, 'Bitte gib die Adresse des Videos an.').max(400),
  provider: z.enum(['youtube', 'twitch', 'link']).default('youtube'),
  posterMediaId: z.string().nullable().default(null),
  description: z.string().max(400).default(''),
});

export const ctaSchema = z.object({
  headline: z.string().min(1, 'Bitte gib eine Überschrift an.').max(120),
  text: z.string().max(400).default(''),
  primaryLink: linkSchema.nullable().default(null),
  secondaryLink: linkSchema.nullable().default(null),
  tone: z.enum(['accent', 'muted']).default('accent'),
});

export const cardGridSchema = z.object({
  eyebrow: z.string().max(60).default(''),
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  cards: z
    .array(
      z.object({
        title: z.string().min(1, 'Bitte gib einen Titel an.').max(80),
        text: z.string().max(400).default(''),
        icon: z
          .enum(['community', 'tournament', 'discord', 'calendar', 'shield', 'star', 'chat', 'swiss'])
          .default('community'),
        link: linkSchema.nullable().default(null),
      }),
    )
    .max(12)
    .default([]),
});

export const statsSchema = z.object({
  headline: z.string().max(120).default(''),
  /** Leer bedeutet: die im Dashboard gepflegten Community-Zahlen verwenden. */
  useCommunityStats: z.boolean().default(true),
  items: z
    .array(
      z.object({
        value: z.string().min(1, 'Bitte gib einen Wert an.').max(30),
        label: z.string().min(1, 'Bitte gib eine Bezeichnung an.').max(60),
        description: z.string().max(160).default(''),
      }),
    )
    .max(6)
    .default([]),
});

export const faqSchema = z.object({
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  items: z
    .array(
      z.object({
        question: z.string().min(1, 'Bitte gib eine Frage an.').max(200),
        answer: z.string().min(1, 'Bitte gib eine Antwort an.').max(2000),
      }),
    )
    .max(20)
    .default([]),
});

export const logoBarSchema = z.object({
  headline: z.string().max(120).default(''),
  /** Leer: alle aktiven, veröffentlichten Sponsoren. */
  sponsorIds: z.array(z.string()).max(24).default([]),
  showTitle: z.boolean().default(true),
});

export const socialHighlightsSchema = z.object({
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  platforms: z
    .array(z.enum(['DISCORD', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITCH', 'OTHER']))
    .max(6)
    .default([]),
  limit: z.coerce.number().int().min(1).max(12).default(6),
  onlyFeatured: z.boolean().default(false),
});

export const tournamentListSchema = z.object({
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  filter: z.enum(['upcoming', 'running', 'past', 'featured', 'all']).default('upcoming'),
  limit: z.coerce.number().int().min(1).max(12).default(3),
  showLinkToOverview: z.boolean().default(true),
});

export const sponsorListSchema = z.object({
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  status: z.enum(['ACTIVE', 'FORMER', 'ALL']).default('ACTIVE'),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  showDescription: z.boolean().default(true),
});

export const teamMembersSchema = z.object({
  headline: z.string().max(120).default(''),
  intro: z.string().max(400).default(''),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export const spacerSchema = z.object({
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  showDivider: z.boolean().default(false),
});

const columnContentSchema = z.object({
  kind: z.enum(['text', 'image', 'links']).default('text'),
  headline: z.string().max(120).default(''),
  markdown: z.string().max(6000).default(''),
  mediaId: z.string().nullable().default(null),
  links: z.array(linkSchema).max(6).default([]),
});

export const twoColumnSchema = z.object({
  eyebrow: z.string().max(60).default(''),
  headline: z.string().max(120).default(''),
  left: columnContentSchema,
  right: columnContentSchema,
  ratio: z.enum(['50-50', '60-40', '40-60']).default('50-50'),
  verticalAlign: z.enum(['top', 'center']).default('top'),
  tone: toneSchema,
});

export const SECTION_SCHEMAS = {
  HERO: heroSchema,
  TEXT: textSchema,
  RICH_TEXT: richTextSchema,
  IMAGE: imageSchema,
  GALLERY: gallerySchema,
  VIDEO: videoSchema,
  CTA: ctaSchema,
  CARD_GRID: cardGridSchema,
  STATS: statsSchema,
  FAQ: faqSchema,
  LOGO_BAR: logoBarSchema,
  SOCIAL_HIGHLIGHTS: socialHighlightsSchema,
  TOURNAMENT_LIST: tournamentListSchema,
  SPONSOR_LIST: sponsorListSchema,
  TEAM_MEMBERS: teamMembersSchema,
  SPACER: spacerSchema,
  TWO_COLUMN: twoColumnSchema,
} as const satisfies Record<SectionType, z.ZodTypeAny>;

export type SectionDataMap = {
  [K in keyof typeof SECTION_SCHEMAS]: z.infer<(typeof SECTION_SCHEMAS)[K]>;
};

export type AnySectionData = SectionDataMap[keyof SectionDataMap];

export type RenderableSection = {
  [K in SectionType]: { id: string; type: K; visible: boolean; data: SectionDataMap[K] };
}[SectionType];

export const SECTION_META: Record<
  SectionType,
  { label: string; description: string; group: 'Struktur' | 'Inhalt' | 'Medien' | 'Dynamisch' }
> = {
  HERO: { label: 'Hero', description: 'Grosser Einstiegsbereich mit Titel, Motto und Buttons.', group: 'Struktur' },
  TEXT: { label: 'Text', description: 'Einfacher Textabschnitt mit optionaler Überschrift.', group: 'Inhalt' },
  RICH_TEXT: { label: 'Rich Text', description: 'Formatierter Text mit Listen, Links und Zwischentiteln.', group: 'Inhalt' },
  IMAGE: { label: 'Bild', description: 'Einzelnes Bild aus der Medienbibliothek.', group: 'Medien' },
  GALLERY: { label: 'Bildergalerie', description: 'Mehrere Bilder in einem Raster.', group: 'Medien' },
  VIDEO: { label: 'Video', description: 'YouTube- oder Twitch-Video, das erst auf Klick geladen wird.', group: 'Medien' },
  CTA: { label: 'Call to Action', description: 'Hervorgehobener Aufruf, z. B. zum Discord-Beitritt.', group: 'Struktur' },
  CARD_GRID: { label: 'Kartenraster', description: 'Mehrere Karten mit Symbol, Titel und Text.', group: 'Inhalt' },
  STATS: { label: 'Statistiken', description: 'Community-Zahlen aus den Einstellungen oder eigene Werte.', group: 'Inhalt' },
  FAQ: { label: 'FAQ', description: 'Aufklappbare Fragen und Antworten.', group: 'Inhalt' },
  LOGO_BAR: { label: 'Logo-/Partnerleiste', description: 'Kompakte Leiste mit Sponsorenlogos.', group: 'Dynamisch' },
  SOCIAL_HIGHLIGHTS: { label: 'Social-Media-Highlights', description: 'Kuratierte Beiträge aus der Social-Verwaltung.', group: 'Dynamisch' },
  TOURNAMENT_LIST: { label: 'Turnierliste', description: 'Turniere nach Status, automatisch aktuell.', group: 'Dynamisch' },
  SPONSOR_LIST: { label: 'Sponsorenliste', description: 'Sponsoren mit Logo und Beschreibung.', group: 'Dynamisch' },
  TEAM_MEMBERS: { label: 'Teammitglieder', description: 'Vorstand oder Team aus der Teamverwaltung.', group: 'Dynamisch' },
  SPACER: { label: 'Abstand / Trenner', description: 'Freiraum oder eine dezente Trennlinie.', group: 'Struktur' },
  TWO_COLUMN: { label: 'Zwei Spalten', description: 'Frei konfigurierbare Sektion mit zwei Spalten.', group: 'Struktur' },
};

/** Standardinhalt beim Hinzufügen eines neuen Blocks im Builder. */
export function defaultSectionData(type: SectionType): AnySectionData {
  switch (type) {
    case 'HERO':
      return heroSchema.parse({ headline: 'Neue Überschrift' });
    case 'IMAGE':
      // Ein Bildblock braucht zwingend ein Medium; der Builder fragt es direkt ab.
      return { mediaId: '', caption: '', width: 'content', rounded: true };
    case 'VIDEO':
      // Die Adresse ist Pflicht, wird aber erst beim Speichern eingefordert –
      // der Block muss zuerst angelegt werden können.
      return {
        headline: '',
        url: '',
        provider: 'youtube',
        posterMediaId: null,
        description: '',
      };
    case 'CTA':
      return ctaSchema.parse({ headline: 'Werde Teil von SwissHub' });
    case 'TWO_COLUMN':
      return twoColumnSchema.parse({
        left: columnContentSchema.parse({}),
        right: columnContentSchema.parse({}),
      });
    default: {
      const schema = SECTION_SCHEMAS[type];
      return schema.parse({}) as AnySectionData;
    }
  }
}

/**
 * Validiert die Rohdaten eines Abschnitts. Ungültige Blöcke werden beim
 * Rendern übersprungen statt die ganze Seite abstürzen zu lassen.
 */
export function parseSection(
  section: { id: string; type: SectionType; visible: boolean; data: unknown },
): RenderableSection | null {
  const schema = SECTION_SCHEMAS[section.type];
  const parsed = schema.safeParse(section.data);
  if (!parsed.success) return null;

  return {
    id: section.id,
    type: section.type,
    visible: section.visible,
    data: parsed.data,
  } as RenderableSection;
}

export function parseSections(
  sections: { id: string; type: SectionType; visible: boolean; data: unknown }[],
): RenderableSection[] {
  return sections
    .map(parseSection)
    .filter((section): section is RenderableSection => section !== null);
}

/** Sammelt alle im Inhalt referenzierten Medien-IDs (für Nutzungsübersicht und Vorabladen). */
export function collectMediaIds(sections: RenderableSection[]): string[] {
  const ids = new Set<string>();

  for (const section of sections) {
    switch (section.type) {
      case 'HERO':
        if (section.data.backgroundMediaId) ids.add(section.data.backgroundMediaId);
        break;
      case 'IMAGE':
        if (section.data.mediaId) ids.add(section.data.mediaId);
        break;
      case 'GALLERY':
        for (const item of section.data.items) ids.add(item.mediaId);
        break;
      case 'VIDEO':
        if (section.data.posterMediaId) ids.add(section.data.posterMediaId);
        break;
      case 'TWO_COLUMN':
        if (section.data.left.mediaId) ids.add(section.data.left.mediaId);
        if (section.data.right.mediaId) ids.add(section.data.right.mediaId);
        break;
      default:
        break;
    }
  }

  return [...ids];
}

/** Alle im Inhalt verwendeten Links – Grundlage der Linkprüfung im Builder. */
export function collectLinks(sections: RenderableSection[]): { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  const push = (link: SectionLink | null | undefined) => {
    if (link?.href) links.push({ href: link.href, label: link.label });
  };

  for (const section of sections) {
    switch (section.type) {
      case 'HERO':
      case 'CTA':
        push(section.data.primaryLink);
        push(section.data.secondaryLink);
        break;
      case 'CARD_GRID':
        for (const card of section.data.cards) push(card.link);
        break;
      case 'TWO_COLUMN':
        for (const link of section.data.left.links) push(link);
        for (const link of section.data.right.links) push(link);
        break;
      case 'VIDEO':
        if (section.data.url) links.push({ href: section.data.url, label: section.data.headline || 'Video' });
        break;
      default:
        break;
    }
  }

  return links;
}
