import type { SectionType } from '@prisma/client';

/**
 * Beschreibung der Eingabefelder je Abschnittstyp.
 *
 * Der Builder erzeugt seine Formulare aus dieser Liste. Dadurch bleibt die
 * Oberfläche einheitlich, und es lassen sich nur Werte setzen, die das
 * Designsystem vorsieht – freie Stil- oder HTML-Eingaben sind ausgeschlossen.
 */

export type SelectOption = { value: string; label: string };

export type FieldDescriptor =
  | { kind: 'text'; key: string; label: string; hint?: string; placeholder?: string; maxLength?: number }
  | { kind: 'textarea'; key: string; label: string; hint?: string; rows?: number; maxLength?: number }
  | { kind: 'markdown'; key: string; label: string; hint?: string; rows?: number }
  | { kind: 'number'; key: string; label: string; hint?: string; min?: number; max?: number }
  | { kind: 'boolean'; key: string; label: string; hint?: string }
  | { kind: 'select'; key: string; label: string; options: SelectOption[]; hint?: string }
  | { kind: 'multiselect'; key: string; label: string; options: SelectOption[]; hint?: string }
  | { kind: 'media'; key: string; label: string; hint?: string; required?: boolean }
  | { kind: 'link'; key: string; label: string; hint?: string }
  | { kind: 'linkList'; key: string; label: string; hint?: string; max?: number }
  | { kind: 'mediaList'; key: string; label: string; hint?: string; max?: number }
  | { kind: 'sponsorPicker'; key: string; label: string; hint?: string }
  | {
      kind: 'objectList';
      key: string;
      label: string;
      hint?: string;
      max?: number;
      addLabel: string;
      itemLabel: string;
      fields: FieldDescriptor[];
      template: Record<string, unknown>;
    }
  | { kind: 'group'; key: string; label: string; fields: FieldDescriptor[] };

const TONE_OPTIONS: SelectOption[] = [
  { value: 'default', label: 'Standard' },
  { value: 'muted', label: 'Abgesetzte Fläche' },
  { value: 'accent', label: 'Akzentfläche' },
];

const COLUMN_OPTIONS: SelectOption[] = [
  { value: '2', label: '2 Spalten' },
  { value: '3', label: '3 Spalten' },
  { value: '4', label: '4 Spalten' },
];

const ICON_OPTIONS: SelectOption[] = [
  { value: 'community', label: 'Community' },
  { value: 'tournament', label: 'Turnier' },
  { value: 'discord', label: 'Discord' },
  { value: 'calendar', label: 'Kalender' },
  { value: 'shield', label: 'Schild' },
  { value: 'star', label: 'Stern' },
  { value: 'chat', label: 'Chat' },
  { value: 'swiss', label: 'Schweizerkreuz' },
];

const PLATFORM_OPTIONS: SelectOption[] = [
  { value: 'DISCORD', label: 'Discord' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'TWITCH', label: 'Twitch' },
  { value: 'OTHER', label: 'Weitere' },
];

const COLUMN_KIND_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Bild' },
  { value: 'links', label: 'Buttons / Links' },
];

const columnFields = (side: 'left' | 'right'): FieldDescriptor => ({
  kind: 'group',
  key: side,
  label: side === 'left' ? 'Linke Spalte' : 'Rechte Spalte',
  fields: [
    { kind: 'select', key: 'kind', label: 'Inhaltstyp', options: COLUMN_KIND_OPTIONS },
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'markdown', key: 'markdown', label: 'Text', rows: 6, hint: 'Nur bei Inhaltstyp „Text“.' },
    { kind: 'media', key: 'mediaId', label: 'Bild', hint: 'Nur bei Inhaltstyp „Bild“.' },
    { kind: 'linkList', key: 'links', label: 'Links', max: 6, hint: 'Nur bei Inhaltstyp „Buttons / Links“.' },
  ],
});

export const SECTION_FIELDS: Record<SectionType, FieldDescriptor[]> = {
  HERO: [
    { kind: 'text', key: 'eyebrow', label: 'Kleiner Vortext', maxLength: 60, placeholder: 'Schweizer Gaming-Community' },
    { kind: 'text', key: 'headline', label: 'Hauptaussage', maxLength: 120 },
    { kind: 'text', key: 'motto', label: 'Motto', maxLength: 80, placeholder: 'Zäme hock, zäme zocke' },
    { kind: 'textarea', key: 'text', label: 'Einleitungstext', rows: 4, maxLength: 600 },
    { kind: 'link', key: 'primaryLink', label: 'Haupt-Button', hint: 'Als Ziel funktioniert auch {discord}: das nutzt automatisch den in den Einstellungen gepflegten Einladungslink.' },
    { kind: 'link', key: 'secondaryLink', label: 'Zweiter Button' },
    { kind: 'media', key: 'backgroundMediaId', label: 'Hintergrundbild', hint: 'Optional. Wird dezent abgedunkelt dargestellt.' },
    { kind: 'boolean', key: 'showLogo', label: 'SwissHub-Logo im Hero anzeigen' },
  ],

  TEXT: [
    { kind: 'text', key: 'eyebrow', label: 'Kleiner Vortext', maxLength: 60 },
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'text', label: 'Text', rows: 8, maxLength: 4000, hint: 'Leerzeile erzeugt einen neuen Absatz.' },
    { kind: 'select', key: 'align', label: 'Ausrichtung', options: [{ value: 'left', label: 'Linksbündig' }, { value: 'center', label: 'Zentriert' }] },
    { kind: 'select', key: 'tone', label: 'Hintergrund', options: TONE_OPTIONS },
  ],

  RICH_TEXT: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    {
      kind: 'markdown',
      key: 'markdown',
      label: 'Formatierter Text',
      rows: 14,
      hint: 'Markdown: **fett**, *kursiv*, ## Zwischentitel, - Listenpunkt, [Text](https://…). Platzhalter aus den Einstellungen: {{siteName}}, {{motto}}, {{kontaktEmail}}, {{vereinsname}}, {{adresse}}, {{vertretung}}, {{register}}.',
    },
    { kind: 'select', key: 'tone', label: 'Hintergrund', options: TONE_OPTIONS },
  ],

  IMAGE: [
    { kind: 'media', key: 'mediaId', label: 'Bild', required: true },
    { kind: 'text', key: 'caption', label: 'Bildunterschrift', maxLength: 200 },
    { kind: 'select', key: 'width', label: 'Breite', options: [{ value: 'content', label: 'Textbreite' }, { value: 'wide', label: 'Volle Breite' }] },
    { kind: 'boolean', key: 'rounded', label: 'Abgerundete Ecken' },
  ],

  GALLERY: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'mediaList', key: 'items', label: 'Bilder', max: 24 },
    { kind: 'select', key: 'columns', label: 'Spalten', options: COLUMN_OPTIONS },
  ],

  VIDEO: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'text', key: 'url', label: 'Video-URL', hint: 'YouTube oder Twitch. Das Video wird erst nach Klick geladen.' },
    {
      kind: 'select',
      key: 'provider',
      label: 'Anbieter',
      options: [
        { value: 'youtube', label: 'YouTube' },
        { value: 'twitch', label: 'Twitch' },
        { value: 'link', label: 'Nur Link anzeigen' },
      ],
    },
    { kind: 'media', key: 'posterMediaId', label: 'Vorschaubild' },
    { kind: 'textarea', key: 'description', label: 'Beschreibung', rows: 3, maxLength: 400 },
  ],

  CTA: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'text', label: 'Text', rows: 3, maxLength: 400 },
    { kind: 'link', key: 'primaryLink', label: 'Haupt-Button' },
    { kind: 'link', key: 'secondaryLink', label: 'Zweiter Button' },
    { kind: 'select', key: 'tone', label: 'Darstellung', options: [{ value: 'accent', label: 'Akzentfläche' }, { value: 'muted', label: 'Ruhige Fläche' }] },
  ],

  CARD_GRID: [
    { kind: 'text', key: 'eyebrow', label: 'Kleiner Vortext', maxLength: 60 },
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    { kind: 'select', key: 'columns', label: 'Spalten', options: COLUMN_OPTIONS },
    {
      kind: 'objectList',
      key: 'cards',
      label: 'Karten',
      addLabel: 'Karte hinzufügen',
      itemLabel: 'Karte',
      max: 12,
      template: { title: '', text: '', icon: 'community', link: null },
      fields: [
        { kind: 'text', key: 'title', label: 'Titel', maxLength: 80 },
        { kind: 'textarea', key: 'text', label: 'Text', rows: 3, maxLength: 400 },
        { kind: 'select', key: 'icon', label: 'Symbol', options: ICON_OPTIONS },
        { kind: 'link', key: 'link', label: 'Link' },
      ],
    },
  ],

  STATS: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    {
      kind: 'boolean',
      key: 'useCommunityStats',
      label: 'Gepflegte Community-Zahlen aus den Einstellungen verwenden',
      hint: 'Empfohlen. Es werden nur als veröffentlicht markierte Zahlen angezeigt.',
    },
    {
      kind: 'objectList',
      key: 'items',
      label: 'Eigene Werte',
      addLabel: 'Wert hinzufügen',
      itemLabel: 'Wert',
      max: 6,
      hint: 'Nur nötig, wenn die Community-Zahlen nicht verwendet werden.',
      template: { value: '', label: '', description: '' },
      fields: [
        { kind: 'text', key: 'value', label: 'Wert', maxLength: 30 },
        { kind: 'text', key: 'label', label: 'Bezeichnung', maxLength: 60 },
        { kind: 'text', key: 'description', label: 'Zusatz', maxLength: 160 },
      ],
    },
  ],

  FAQ: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    {
      kind: 'objectList',
      key: 'items',
      label: 'Fragen',
      addLabel: 'Frage hinzufügen',
      itemLabel: 'Frage',
      max: 20,
      template: { question: '', answer: '' },
      fields: [
        { kind: 'text', key: 'question', label: 'Frage', maxLength: 200 },
        { kind: 'markdown', key: 'answer', label: 'Antwort', rows: 5 },
      ],
    },
  ],

  LOGO_BAR: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'boolean', key: 'showTitle', label: 'Überschrift anzeigen' },
    {
      kind: 'sponsorPicker',
      key: 'sponsorIds',
      label: 'Sponsoren',
      hint: 'Keine Auswahl bedeutet: alle aktiven, veröffentlichten Sponsoren.',
    },
  ],

  SOCIAL_HIGHLIGHTS: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    { kind: 'multiselect', key: 'platforms', label: 'Plattformen', options: PLATFORM_OPTIONS, hint: 'Keine Auswahl bedeutet: alle Plattformen.' },
    { kind: 'number', key: 'limit', label: 'Anzahl Beiträge', min: 1, max: 12 },
    { kind: 'boolean', key: 'onlyFeatured', label: 'Nur hervorgehobene Beiträge' },
  ],

  TOURNAMENT_LIST: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    {
      kind: 'select',
      key: 'filter',
      label: 'Auswahl',
      options: [
        { value: 'upcoming', label: 'Anstehende Turniere' },
        { value: 'running', label: 'Laufende Turniere' },
        { value: 'past', label: 'Vergangene Turniere' },
        { value: 'featured', label: 'Hervorgehobene Turniere' },
        { value: 'all', label: 'Alle Turniere' },
      ],
    },
    { kind: 'number', key: 'limit', label: 'Anzahl', min: 1, max: 12 },
    { kind: 'boolean', key: 'showLinkToOverview', label: 'Link zur Turnierübersicht anzeigen' },
  ],

  SPONSOR_LIST: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    {
      kind: 'select',
      key: 'status',
      label: 'Auswahl',
      options: [
        { value: 'ACTIVE', label: 'Aktive Partner' },
        { value: 'FORMER', label: 'Ehemalige Partner' },
        { value: 'ALL', label: 'Alle' },
      ],
    },
    { kind: 'number', key: 'limit', label: 'Anzahl', min: 1, max: 24 },
    { kind: 'boolean', key: 'showDescription', label: 'Kurzbeschreibung anzeigen' },
  ],

  TEAM_MEMBERS: [
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    { kind: 'textarea', key: 'intro', label: 'Einleitung', rows: 3, maxLength: 400 },
    { kind: 'number', key: 'limit', label: 'Anzahl', min: 1, max: 24 },
  ],

  SPACER: [
    {
      kind: 'select',
      key: 'size',
      label: 'Grösse',
      options: [
        { value: 'small', label: 'Klein' },
        { value: 'medium', label: 'Mittel' },
        { value: 'large', label: 'Gross' },
      ],
    },
    { kind: 'boolean', key: 'showDivider', label: 'Trennlinie anzeigen' },
  ],

  TWO_COLUMN: [
    { kind: 'text', key: 'eyebrow', label: 'Kleiner Vortext', maxLength: 60 },
    { kind: 'text', key: 'headline', label: 'Überschrift', maxLength: 120 },
    {
      kind: 'select',
      key: 'ratio',
      label: 'Spaltenverhältnis',
      options: [
        { value: '50-50', label: '50 / 50' },
        { value: '60-40', label: '60 / 40' },
        { value: '40-60', label: '40 / 60' },
      ],
    },
    {
      kind: 'select',
      key: 'verticalAlign',
      label: 'Vertikale Ausrichtung',
      options: [
        { value: 'top', label: 'Oben' },
        { value: 'center', label: 'Mittig' },
      ],
    },
    { kind: 'select', key: 'tone', label: 'Hintergrund', options: TONE_OPTIONS },
    columnFields('left'),
    columnFields('right'),
  ],
};
