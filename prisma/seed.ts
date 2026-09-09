/**
 * Grundausstattung der Datenbank.
 *
 * Der Seed legt an, was die Anwendung zum Betrieb braucht: Berechtigungen,
 * Rollen, Menüs, Kontaktkategorien, die E-Mail-Vorlage sowie die Grundstruktur
 * der Pflichtseiten mit den bestätigten SwissHub-Inhalten.
 *
 * Bewusst NICHT enthalten:
 *  - erfundene Community-Zahlen, Sponsoren, Turniere oder Social-Beiträge
 *  - Zugangsdaten, Links oder Adressen, die nicht gesichert bekannt sind
 *
 * Der Seed ist idempotent: bestehende Inhalte werden nicht überschrieben.
 */
import { PageStatus, PrismaClient, type Prisma, type SectionType } from '@prisma/client';
import { PERMISSION_CATALOGUE, ROLE_CATALOGUE } from '../src/lib/permissions';

const prisma = new PrismaClient();

type SeedSection = { type: SectionType; data: Record<string, unknown> };

async function seedPermissionsAndRoles(): Promise<void> {
  for (const permission of PERMISSION_CATALOGUE) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: {
        name: permission.name,
        description: permission.description,
        group: permission.group,
        sortOrder: permission.sortOrder,
      },
    });
  }

  for (const role of ROLE_CATALOGUE) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        sortOrder: role.sortOrder,
        isSystem: true,
      },
      // Name und Beschreibung bleiben pflegbar; nur die Systemkennzeichnung wird erzwungen.
      update: { isSystem: true },
      select: { id: true, permissions: { select: { permissionId: true } } },
    });

    // Bestehende Zuweisungen bleiben erhalten – der Seed ergänzt nur fehlende
    // Berechtigungen der Standardrollen, damit angepasste Rollen nicht
    // ungewollt zurückgesetzt werden.
    if (record.permissions.length > 0) continue;

    const permissions = await prisma.permission.findMany({
      where: { key: { in: role.permissions } },
      select: { id: true },
    });

    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: record.id, permissionId: permission.id })),
      skipDuplicates: true,
    });
  }

  console.log(`✓ ${PERMISSION_CATALOGUE.length} Berechtigungen und ${ROLE_CATALOGUE.length} Rollen abgeglichen`);
}

async function seedNavigation(): Promise<void> {
  const menus = [
    {
      key: 'main',
      name: 'Hauptnavigation',
      items: [
        { label: 'Start', href: '/', position: 0 },
        { label: 'Über uns', href: '/ueber-uns', position: 1 },
        { label: 'Turniere', href: '/turniere', position: 2 },
        { label: 'Partner', href: '/partner', position: 3 },
        { label: 'Social Media', href: '/social', position: 4 },
        { label: 'Kontakt', href: '/kontakt', position: 5 },
      ],
    },
    {
      key: 'footer',
      name: 'Fussbereich',
      items: [
        { label: 'Über uns', href: '/ueber-uns', position: 0 },
        { label: 'Turniere', href: '/turniere', position: 1 },
        { label: 'Partner & Sponsoren', href: '/partner', position: 2 },
        { label: 'Social Media', href: '/social', position: 3 },
      ],
    },
  ];

  for (const menu of menus) {
    const navigation = await prisma.navigation.upsert({
      where: { key: menu.key },
      create: { key: menu.key, name: menu.name },
      update: {},
      select: { id: true, items: { select: { id: true } } },
    });

    if (navigation.items.length > 0) continue;

    await prisma.navigationItem.createMany({
      data: menu.items.map((item) => ({ ...item, navigationId: navigation.id })),
    });
  }

  console.log('✓ Navigation angelegt');
}

async function seedContactCategories(): Promise<void> {
  const categories = [
    { key: 'allgemein', label: 'Allgemeine Anfrage', description: 'Fragen rund um SwissHub.', sortOrder: 10 },
    { key: 'partnerschaft', label: 'Partnerschaft', description: 'Kooperationen mit Vereinen, Organisationen und Communities.', sortOrder: 20 },
    { key: 'sponsoring', label: 'Sponsoring', description: 'Unterstützung von Turnieren, Events und Community-Projekten.', sortOrder: 30 },
    { key: 'turniere', label: 'Turniere & Events', description: 'Fragen zu Ausschreibungen, Anmeldung und Ablauf.', sortOrder: 40 },
    { key: 'medien', label: 'Medien & Presse', description: 'Anfragen von Medienschaffenden.', sortOrder: 50 },
    { key: 'technik', label: 'Technisches Problem', description: 'Fehler oder Probleme auf dieser Website.', sortOrder: 60 },
    { key: 'sonstiges', label: 'Sonstiges', description: 'Alles, was in keine andere Kategorie passt.', sortOrder: 70 },
  ];

  for (const category of categories) {
    await prisma.contactCategory.upsert({
      where: { key: category.key },
      create: category,
      update: { label: category.label, description: category.description, sortOrder: category.sortOrder },
    });
  }

  console.log(`✓ ${categories.length} Kontaktkategorien angelegt`);
}

async function seedEmailTemplate(): Promise<void> {
  await prisma.emailTemplate.upsert({
    where: { key: 'contact-confirmation' },
    create: {
      key: 'contact-confirmation',
      name: 'Eingangsbestätigung Kontaktformular',
      description: 'Wird an die anfragende Person gesendet, sofern die Bestätigung aktiviert ist.',
      subject: 'Wir haben deine Anfrage erhalten ({{reference}})',
      bodyMarkdown: [
        'Hallo {{name}}',
        '',
        'danke für deine Nachricht an {{siteName}}. Wir haben deine Anfrage erhalten und melden uns so bald wie möglich bei dir.',
        '',
        'Deine Referenz lautet **{{reference}}** – bitte gib sie bei Rückfragen an.',
        '',
        'Für Fragen rund um die Community und den Support nutzt du am besten unser Ticketsystem auf Discord.',
        '',
        'Liebe Grüsse',
        'Das Team von {{siteName}}',
      ].join('\n'),
    },
    update: {},
  });

  console.log('✓ E-Mail-Vorlage angelegt');
}

async function seedFeatureFlags(): Promise<void> {
  const flags = [
    { key: 'social-highlights', label: 'Social-Media-Highlights', description: 'Kuratierte Beiträge auf der Startseite anzeigen.', enabled: true },
    { key: 'team-section', label: 'Team- und Vereinsbereich', description: 'Teammitglieder auf der Seite „Über uns“ anzeigen.', enabled: true },
    { key: 'tournament-archive', label: 'Turnierarchiv', description: 'Vergangene Turniere öffentlich zugänglich machen.', enabled: true },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { label: flag.label, description: flag.description },
    });
  }

  console.log(`✓ ${flags.length} Feature-Schalter angelegt`);
}

async function seedTournamentGames(): Promise<void> {
  const games = [
    { slug: 'counter-strike-2', name: 'Counter-Strike 2', shortName: 'CS2', sortOrder: 10 },
    { slug: 'league-of-legends', name: 'League of Legends', shortName: 'LoL', sortOrder: 20 },
    { slug: 'valorant', name: 'Valorant', shortName: 'Valorant', sortOrder: 30 },
    { slug: 'apex-legends', name: 'Apex Legends', shortName: 'Apex', sortOrder: 40 },
  ];

  for (const game of games) {
    await prisma.tournamentGame.upsert({
      where: { slug: game.slug },
      create: game,
      update: { name: game.name, shortName: game.shortName },
    });
  }

  console.log(`✓ ${games.length} Spiele angelegt`);
}

async function seedSettings(): Promise<void> {
  // Nur gesicherte Angaben. Alles Weitere (Discord-Link, Vereinsadresse,
  // Community-Zahlen) wird bewusst im Dashboard gepflegt.
  const values: Record<string, { group: string; value: Prisma.InputJsonValue }> = {
    siteName: { group: 'allgemein', value: 'SwissHub' },
    motto: { group: 'allgemein', value: 'Zäme hock, zäme zocke' },
    contactEmail: { group: 'allgemein', value: 'info@swisshub.gg' },
    legalEntityName: { group: 'rechtliches', value: 'SwissHub' },
    seoDefaultTitle: { group: 'seo', value: 'SwissHub – Schweizer Gaming-Community' },
    seoDefaultDescription: {
      group: 'seo',
      value:
        'SwissHub ist die Schweizer Gaming-Community: gemeinsam spielen, Turniere erleben und neue Leute aus der ganzen Schweiz kennenlernen.',
    },
  };

  for (const [key, entry] of Object.entries(values)) {
    await prisma.globalSetting.upsert({
      where: { key },
      create: { key, group: entry.group, value: entry.value },
      update: {},
    });
  }

  console.log(`✓ ${Object.keys(values).length} Grundeinstellungen angelegt`);
}

// ---------------------------------------------------------------------------
// Seiteninhalte
// ---------------------------------------------------------------------------

const homeSections: SeedSection[] = [
  {
    type: 'HERO',
    data: {
      eyebrow: 'Schweizer Gaming-Community',
      headline: 'Willkommen in der Schweizer Gaming-Community',
      motto: 'Zäme hock, zäme zocke',
      text: 'SwissHub ist der digitale Treffpunkt für alle, die in der Schweiz gerne gemeinsam spielen. Bei uns findest du Mitspielende, Turniere, Events und eine Community, in der Respekt und Offenheit selbstverständlich sind.',
      primaryLink: { label: 'Discord beitreten', href: '{discord}', style: 'primary', external: true },
      secondaryLink: { label: 'Turniere ansehen', href: '/turniere', style: 'secondary', external: false },
      backgroundMediaId: null,
      showLogo: true,
    },
  },
  {
    type: 'CARD_GRID',
    data: {
      eyebrow: 'Das erwartet dich',
      headline: 'Eine Community für die ganze Schweiz',
      intro: 'SwissHub bringt Menschen zusammen, die sich für Gaming, Esports, Technik und Online-Themen interessieren – vom gelegentlichen Feierabendspiel bis zum ambitionierten Turnier.',
      columns: 4,
      cards: [
        {
          title: 'Gemeinsam spielen',
          text: 'Finde jederzeit Mitspielende für dein Lieblingsspiel – ohne feste Verpflichtungen und ohne Bewerbungsverfahren.',
          icon: 'community',
          link: null,
        },
        {
          title: 'Turniere und Events',
          text: 'Wir organisieren regelmässig Turniere in verschiedenen Spielen sowie lockere Community-Abende.',
          icon: 'tournament',
          link: { label: 'Zu den Turnieren', href: '/turniere', style: 'ghost', external: false },
        },
        {
          title: 'Offen und respektvoll',
          text: 'Akzeptanz, Toleranz und Gemeinschaft sind bei uns keine Floskeln, sondern gelebte Grundregeln.',
          icon: 'shield',
          link: { label: 'Mehr über uns', href: '/ueber-uns', style: 'ghost', external: false },
        },
        {
          title: 'Discord als Treffpunkt',
          text: 'Der Discord ist unser Zuhause: dort läuft der Alltag, dort entstehen Teams, dort erreichst du den Support.',
          icon: 'discord',
          link: null,
        },
      ],
    },
  },
  {
    type: 'STATS',
    data: { headline: 'SwissHub in Zahlen', useCommunityStats: true, items: [] },
  },
  {
    type: 'TOURNAMENT_LIST',
    data: {
      headline: 'Aktuelle und nächste Turniere',
      intro: 'Unsere Turniere reichen vom lockeren Community-Cup bis zum grösseren Wettbewerb. Alle Ausschreibungen findest du in der Übersicht.',
      filter: 'upcoming',
      limit: 3,
      showLinkToOverview: true,
    },
  },
  {
    type: 'SOCIAL_HIGHLIGHTS',
    data: {
      headline: 'Aus der Community',
      intro: 'Ausgewählte Beiträge, Clips und Rückblicke aus unseren Kanälen.',
      platforms: [],
      limit: 6,
      onlyFeatured: false,
    },
  },
  {
    type: 'LOGO_BAR',
    data: { headline: 'Unterstützt von', showTitle: true, sponsorIds: [] },
  },
  {
    type: 'CTA',
    data: {
      headline: 'Bereit für die nächste Runde?',
      text: 'Komm auf unseren Discord, stell dich kurz vor und such dir deine Spiele aus. Der Rest ergibt sich meist von selbst.',
      primaryLink: { label: 'Discord beitreten', href: '{discord}', style: 'primary', external: true },
      secondaryLink: { label: 'Alle Kanäle ansehen', href: '/social', style: 'secondary', external: false },
      tone: 'accent',
    },
  },
];

const aboutSections: SeedSection[] = [
  {
    type: 'HERO',
    data: {
      eyebrow: 'Über SwissHub',
      headline: 'Ein Verein, eine Community, ein Treffpunkt',
      motto: 'Zäme hock, zäme zocke',
      text: 'SwissHub ist ein Schweizer Verein und eine Gaming-Community, die Menschen aus der ganzen Schweiz zusammenbringt.',
      primaryLink: { label: 'Discord beitreten', href: '{discord}', style: 'primary', external: true },
      secondaryLink: null,
      backgroundMediaId: null,
      showLogo: false,
    },
  },
  {
    type: 'RICH_TEXT',
    data: {
      headline: 'Wie SwissHub entstanden ist',
      markdown: [
        'SwissHub wurde 2021 gegründet – aus dem einfachen Gedanken heraus, dass gemeinsames Spielen mehr Spass macht als allein zu warten, bis sich zufällig jemand findet.',
        '',
        'Aus einer kleinen Runde ist über die Jahre ein Treffpunkt für die Schweizer Gaming- und Online-Gesellschaft geworden. Heute ist SwissHub ein Verein mit einem klaren Ziel: einen Ort schaffen, an dem sich Menschen aus der Schweiz und der Deutschschweiz unkompliziert finden, gemeinsam spielen und Neues ausprobieren können.',
        '',
        '## Unsere Mission',
        '',
        'Wir möchten das Zusammenspielen in der Schweiz so einfach wie möglich machen: ohne Hürden, ohne Aufnahmeprüfung und ohne den Druck, ständig verfügbar sein zu müssen. Wer mitmachen will, ist willkommen.',
        '',
        '## Unsere Vision',
        '',
        'Eine Schweizer Gaming-Community, die verlässlich, offen und langfristig besteht – getragen von den Menschen, die mitmachen, und unterstützt von Partnern, die an dieselbe Idee glauben.',
      ].join('\n'),
      tone: 'default',
    },
  },
  {
    type: 'CARD_GRID',
    data: {
      eyebrow: 'Werte',
      headline: 'Worauf wir Wert legen',
      intro: '',
      columns: 3,
      cards: [
        { title: 'Gemeinschaft', text: 'Wir sind kein einzelnes Team, sondern eine breite Community mit Platz für viele Spiele und Interessen.', icon: 'community', link: null },
        { title: 'Akzeptanz', text: 'Alle sind willkommen, unabhängig von Erfahrung, Spielstärke oder Hintergrund.', icon: 'star', link: null },
        { title: 'Toleranz', text: 'Wir gehen respektvoll miteinander um. Beleidigungen und Ausgrenzung haben bei uns keinen Platz.', icon: 'shield', link: null },
        { title: 'Offenheit', text: 'Neue Ideen, neue Spiele, neue Gesichter: Wir bleiben neugierig und ansprechbar.', icon: 'chat', link: null },
        { title: 'Verlässlichkeit', text: 'Angekündigte Turniere und Events finden statt. Auf unsere Organisation kannst du dich verlassen.', icon: 'calendar', link: null },
        { title: 'Schweizer Identität', text: 'Wir sind hier zu Hause: mit Schweizer Community, Schweizer Turnieren und Schweizer Umgangston.', icon: 'swiss', link: null },
      ],
    },
  },
  {
    type: 'TWO_COLUMN',
    data: {
      eyebrow: 'So läuft es bei uns',
      headline: 'Discord, Turniere und alles dazwischen',
      ratio: '50-50',
      verticalAlign: 'top',
      tone: 'muted',
      left: {
        kind: 'text',
        headline: 'Discord ist der Treffpunkt',
        markdown: [
          'Der Discord-Server ist das Herz von SwissHub. Dort findest du Kanäle für die einzelnen Spiele, freie Sprachkanäle für spontane Runden und Ankündigungen zu allem, was ansteht.',
          '',
          'Auch der Support läuft über Discord: Über das Ticketsystem erreichst du das Team direkt und nachvollziehbar.',
        ].join('\n'),
        mediaId: null,
        links: [],
      },
      right: {
        kind: 'text',
        headline: 'Turniere und Events',
        markdown: [
          'Wir veranstalten Turniere in verschiedenen Spielen – bisher unter anderem in League of Legends, Valorant und Apex Legends. Counter-Strike 2 gehört ebenfalls zum aktuellen SwissHub-Umfeld.',
          '',
          'Dazu kommen lockere Community-Abende, bei denen es weniger um Ergebnisse und mehr ums gemeinsame Spielen geht.',
        ].join('\n'),
        mediaId: null,
        links: [],
      },
    },
  },
  {
    type: 'STATS',
    data: { headline: 'SwissHub in Zahlen', useCommunityStats: true, items: [] },
  },
  {
    type: 'TEAM_MEMBERS',
    data: { headline: 'Team & Verein', intro: 'Die Menschen hinter SwissHub.', limit: 12 },
  },
  {
    type: 'CTA',
    data: {
      headline: 'Lust mitzumachen?',
      text: 'Schau auf unserem Discord vorbei – ganz unverbindlich.',
      primaryLink: { label: 'Discord beitreten', href: '{discord}', style: 'primary', external: true },
      secondaryLink: { label: 'Kontakt aufnehmen', href: '/kontakt', style: 'secondary', external: false },
      tone: 'accent',
    },
  },
];

const imprintSections: SeedSection[] = [
  {
    type: 'RICH_TEXT',
    data: {
      headline: 'Impressum',
      markdown: [
        '## Verantwortlich für diese Website',
        '',
        '**{{vereinsname}}**',
        '',
        '{{adresse}}',
        '',
        'E-Mail: [{{kontaktEmail}}](mailto:{{kontaktEmail}})',
        '',
        '{{vertretung}}',
        '',
        '{{register}}',
        '',
        '## Rechtsform',
        '',
        'SwissHub ist ein Verein nach Schweizer Recht.',
        '',
        '## Haftung für Inhalte',
        '',
        'Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität kann jedoch keine Gewähr übernommen werden.',
        '',
        '## Haftung für Links',
        '',
        'Diese Website enthält Verweise auf externe Angebote. Für deren Inhalte sind ausschliesslich deren Betreiber verantwortlich. Zum Zeitpunkt der Verlinkung waren keine rechtswidrigen Inhalte erkennbar.',
        '',
        '## Urheberrecht',
        '',
        'Die auf dieser Website veröffentlichten Inhalte, Bilder und das SwissHub-Logo sind urheberrechtlich geschützt. Eine Verwendung ausserhalb der gesetzlich erlaubten Fälle bedarf der vorherigen schriftlichen Zustimmung.',
      ].join('\n'),
      tone: 'default',
    },
  },
];

const privacySections: SeedSection[] = [
  {
    type: 'RICH_TEXT',
    data: {
      headline: 'Datenschutzerklärung',
      markdown: [
        'Der Schutz deiner Daten ist uns wichtig. Diese Erklärung informiert darüber, welche Daten beim Besuch dieser Website bearbeitet werden. Grundlage ist das Schweizer Datenschutzgesetz (DSG).',
        '',
        '## Verantwortliche Stelle',
        '',
        '**{{vereinsname}}**',
        '',
        '{{adresse}}',
        '',
        'E-Mail: [{{kontaktEmail}}](mailto:{{kontaktEmail}})',
        '',
        '## Aufruf der Website',
        '',
        'Beim Aufruf dieser Website verarbeitet unser Server technisch notwendige Daten wie die aufgerufene Adresse, den Zeitpunkt und die IP-Adresse. Diese Daten sind für den Betrieb und die Sicherheit erforderlich und werden nicht zur Profilbildung verwendet.',
        '',
        '## Nutzungsstatistik',
        '',
        'Wir erheben eine einfache, anonyme Nutzungsstatistik: gespeichert werden ausschliesslich Tagessummen pro Seite oder Klickziel. Es werden dafür keine Cookies gesetzt, keine IP-Adressen gespeichert und keine externen Dienste eingebunden. Ein Rückschluss auf einzelne Personen ist nicht möglich.',
        '',
        '## Kontaktformular',
        '',
        'Wenn du uns über das Kontaktformular schreibst, speichern wir deine Angaben (Name, E-Mail-Adresse, allenfalls Organisation, Betreff, Kategorie und Nachricht), um deine Anfrage zu bearbeiten. Zur Missbrauchsabwehr speichern wir zusätzlich einen pseudonymisierten Wert deiner IP-Adresse sowie die Browserkennung.',
        '',
        'Die Angaben werden nur zur Bearbeitung deiner Anfrage verwendet und nicht ohne deine Einwilligung an Dritte weitergegeben. Nach Ablauf der im Dashboard eingestellten Aufbewahrungsfrist werden Anfragen automatisch anonymisiert. Du kannst die Löschung deiner Anfrage jederzeit verlangen.',
        '',
        '## Externe Inhalte',
        '',
        'Videos von YouTube und Twitch werden erst geladen, wenn du sie ausdrücklich startest. Bis dahin wird keine Verbindung zu diesen Anbietern aufgebaut. Beim Abspielen gelten die Datenschutzbestimmungen des jeweiligen Anbieters.',
        '',
        'Beiträge aus sozialen Netzwerken zeigen wir mit lokal gespeicherten Vorschaubildern an. Es werden dabei keine Daten an die Plattformen übertragen.',
        '',
        '## Speicherung im Browser',
        '',
        'Wir setzen keine Cookies zu Werbe- oder Trackingzwecken. Für den Admin-Bereich wird ein technisch notwendiges Sitzungs-Cookie verwendet. Zusätzlich kann im lokalen Speicher deines Browsers festgehalten werden, ob du einen Hinweis bereits gesehen hast.',
        '',
        '## Deine Rechte',
        '',
        'Du hast das Recht auf Auskunft über die zu deiner Person bearbeiteten Daten sowie auf Berichtigung, Löschung oder Einschränkung der Bearbeitung. Wende dich dafür an [{{kontaktEmail}}](mailto:{{kontaktEmail}}).',
        '',
        '## Sicherheit',
        '',
        'Diese Website wird über eine verschlüsselte Verbindung (HTTPS) ausgeliefert. Wir treffen angemessene technische und organisatorische Massnahmen, um deine Daten zu schützen.',
      ].join('\n'),
      tone: 'default',
    },
  },
];

const cookieSections: SeedSection[] = [
  {
    type: 'RICH_TEXT',
    data: {
      headline: 'Cookies und Speicherung im Browser',
      markdown: [
        'Diese Website kommt ohne Werbe- und Trackingcookies aus. Nachfolgend findest du eine vollständige Übersicht darüber, was gespeichert wird.',
        '',
        '## Technisch notwendig',
        '',
        '- **swisshub_session** – Sitzungs-Cookie des Admin-Bereichs. Wird nur nach einer Anmeldung gesetzt und beim Abmelden gelöscht.',
        '- **swisshub_oauth** – kurzlebiges Cookie während der Anmeldung über Discord. Es dient dem Schutz vor untergeschobenen Anmeldungen und wird nach wenigen Minuten ungültig.',
        '',
        '## Lokaler Speicher',
        '',
        '- **swisshub.privacy-notice** – hält fest, ob du den Datenschutzhinweis bereits bestätigt hast. Diese Information verlässt deinen Browser nicht.',
        '',
        '## Keine Cookies für Statistik',
        '',
        'Unsere Nutzungsstatistik arbeitet ohne Cookies und ohne Wiedererkennung. Es werden ausschliesslich anonyme Tagessummen gespeichert.',
        '',
        '## Externe Anbieter',
        '',
        'Videos von YouTube und Twitch werden erst nach deinem ausdrücklichen Klick geladen. Erst dann können die jeweiligen Anbieter Cookies setzen. Mehr dazu steht in unserer [Datenschutzerklärung](/datenschutz).',
      ].join('\n'),
      tone: 'default',
    },
  },
];

const termsSections: SeedSection[] = [
  {
    type: 'RICH_TEXT',
    data: {
      headline: 'Nutzungsbedingungen',
      markdown: [
        'Diese Bedingungen gelten für die Nutzung der Website von {{siteName}}.',
        '',
        '## Inhalte dieser Website',
        '',
        'Die Inhalte dienen der Information über die Community, ihre Turniere und ihre Partner. Wir bemühen uns um Aktualität, können sie aber nicht in jedem Fall garantieren.',
        '',
        '## Verhalten in der Community',
        '',
        'Für die Teilnahme an unserem Discord-Server und an Turnieren gelten die dort veröffentlichten Regeln. Grundsätzlich gilt: respektvoller Umgang, keine Beleidigungen, keine Diskriminierung und kein Betrug.',
        '',
        '## Turnierteilnahme',
        '',
        'Für jedes Turnier gelten die in der jeweiligen Ausschreibung veröffentlichten Regeln. Bei Verstössen kann das Turnierteam Teilnehmende ausschliessen.',
        '',
        '## Externe Links',
        '',
        'Für Inhalte verlinkter Websites sind ausschliesslich deren Betreiber verantwortlich.',
        '',
        '## Änderungen',
        '',
        'Wir können diese Bedingungen anpassen, wenn sich Angebot oder rechtliche Rahmenbedingungen ändern. Es gilt jeweils die auf dieser Seite veröffentlichte Fassung.',
        '',
        '## Kontakt',
        '',
        'Fragen zu diesen Bedingungen richtest du an [{{kontaktEmail}}](mailto:{{kontaktEmail}}).',
      ].join('\n'),
      tone: 'default',
    },
  },
];

type SeedPage = {
  slug: string;
  title: string;
  isSystem: boolean;
  seoTitle: string;
  seoDescription: string;
  sections: SeedSection[];
  publish: boolean;
};

const pages: SeedPage[] = [
  {
    slug: 'home',
    title: 'Startseite',
    isSystem: true,
    seoTitle: 'SwissHub – Schweizer Gaming-Community',
    seoDescription:
      'SwissHub ist die Schweizer Gaming-Community: gemeinsam spielen, Turniere erleben und neue Leute aus der ganzen Schweiz kennenlernen. Zäme hock, zäme zocke.',
    sections: homeSections,
    publish: true,
  },
  {
    slug: 'ueber-uns',
    title: 'Über uns',
    isSystem: false,
    seoTitle: 'Über SwissHub – Schweizer Gaming-Community seit 2021',
    seoDescription:
      'SwissHub ist ein Schweizer Verein und eine Gaming-Community: gegründet 2021, offen für alle, mit Discord als zentralem Treffpunkt und regelmässigen Turnieren.',
    sections: aboutSections,
    publish: true,
  },
  {
    slug: 'impressum',
    title: 'Impressum',
    isSystem: true,
    seoTitle: 'Impressum',
    seoDescription: 'Impressum und Angaben zum Verein SwissHub.',
    sections: imprintSections,
    publish: true,
  },
  {
    slug: 'datenschutz',
    title: 'Datenschutz',
    isSystem: true,
    seoTitle: 'Datenschutzerklärung',
    seoDescription: 'Informationen zur Bearbeitung von Personendaten auf swisshub.gg.',
    sections: privacySections,
    publish: true,
  },
  {
    slug: 'cookies',
    title: 'Cookies',
    isSystem: true,
    seoTitle: 'Cookies und Speicherung im Browser',
    seoDescription: 'Übersicht über alle Cookies und lokal gespeicherten Informationen auf swisshub.gg.',
    sections: cookieSections,
    publish: true,
  },
  {
    slug: 'nutzungsbedingungen',
    title: 'Nutzungsbedingungen',
    isSystem: false,
    seoTitle: 'Nutzungsbedingungen',
    seoDescription: 'Bedingungen für die Nutzung der Website und der Angebote von SwissHub.',
    sections: termsSections,
    publish: true,
  },
];

async function seedPages(): Promise<void> {
  let created = 0;

  for (const page of pages) {
    const existing = await prisma.page.findUnique({ where: { slug: page.slug }, select: { id: true } });
    if (existing) continue;

    const snapshotSections = page.sections.map((section, index) => ({
      id: `seed-${page.slug}-${index}`,
      type: section.type,
      visible: true,
      data: section.data,
    }));

    const record = await prisma.page.create({
      data: {
        slug: page.slug,
        title: page.title,
        isSystem: page.isSystem,
        status: page.publish ? PageStatus.PUBLISHED : PageStatus.DRAFT,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        publishedAt: page.publish ? new Date() : null,
        publishedContent: page.publish
          ? ({ title: page.title, sections: snapshotSections } as unknown as Prisma.InputJsonValue)
          : undefined,
        sections: {
          create: page.sections.map((section, index) => ({
            type: section.type,
            position: index,
            visible: true,
            data: section.data as Prisma.InputJsonValue,
          })),
        },
      },
      select: { id: true },
    });

    if (page.publish) {
      // Der veröffentlichte Snapshot verweist auf die tatsächlichen Abschnitts-IDs.
      const sections = await prisma.pageSection.findMany({
        where: { pageId: record.id },
        orderBy: { position: 'asc' },
      });

      const snapshot = {
        title: page.title,
        sections: sections.map((section) => ({
          id: section.id,
          type: section.type,
          visible: section.visible,
          data: section.data,
        })),
      };

      await prisma.page.update({
        where: { id: record.id },
        data: { publishedContent: snapshot as unknown as Prisma.InputJsonValue },
      });

      await prisma.pageVersion.create({
        data: {
          pageId: record.id,
          version: 1,
          changeType: 'seed',
          label: 'Erstinstallation',
          content: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    }

    created += 1;
  }

  console.log(`✓ ${created} von ${pages.length} Seiten neu angelegt (bestehende bleiben unverändert)`);
}

async function main(): Promise<void> {
  console.log('SwissHub – Grunddaten werden angelegt …\n');

  await seedPermissionsAndRoles();
  await seedNavigation();
  await seedContactCategories();
  await seedEmailTemplate();
  await seedFeatureFlags();
  await seedTournamentGames();
  await seedSettings();
  await seedPages();

  console.log('\nFertig. Nächste Schritte:');
  console.log('  1. DISCORD_* Umgebungsvariablen setzen und als Superadmin anmelden.');
  console.log('  2. Unter Einstellungen den Discord-Einladungslink und die Vereinsadresse ergänzen.');
  console.log('  3. Community-Zahlen, Sponsoren, Social-Accounts und Turniere im Dashboard pflegen.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed fehlgeschlagen:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
