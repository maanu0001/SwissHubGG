/**
 * Stellt gespeicherte Adressen auf eine neue Domain um.
 *
 * Wozu: Die Anwendung erzeugt jede absolute Adresse aus `APP_URL` – Canonical,
 * Sitemap, Open Graph, Login-Weiterleitung und E-Mail-Links wandern deshalb
 * allein mit der Umgebungsvariablen mit. Was in der Datenbank steht, wandert
 * nicht mit: Links in Seitenabschnitten, E-Mail-Vorlagen, Menüpunkten,
 * Weiterleitungen und Einstellungen bleiben auf der alten Domain stehen.
 *
 * Aufruf:
 *
 *   npm run domain:migrate                     Vorschau, schreibt nichts
 *   npm run domain:migrate -- --anwenden       schreibt die Änderungen
 *   npm run domain:migrate -- --von alt.example --nach https://neu.example
 *
 * Eigenschaften:
 *
 *  - **Vorschau zuerst.** Ohne `--anwenden` wird ausschliesslich gelesen.
 *  - **Wiederholbar.** Ein zweiter Lauf findet nichts mehr; ein abgebrochener
 *    Lauf lässt sich gefahrlos erneut starten.
 *  - **Eng begrenzt.** Ersetzt werden nur Vorkommen des alten Hosts (Regeln in
 *    `src/lib/domainRewrite.ts`). Andere Subdomains, fremde Adressen und alles
 *    übrige bleiben unberührt.
 *  - **Ohne Verlauf.** Versandte E-Mails (`EmailJob`) und das Protokoll
 *    (`AuditLog`, Kontaktnachrichten) werden nicht angefasst: Sie halten fest,
 *    was tatsächlich geschah.
 */
import { PrismaClient } from '@prisma/client';
import {
  containsHost,
  excerptAround,
  parseTarget,
  rewriteJson,
  rewriteText,
  type DomainRewrite,
} from '@/lib/domainRewrite';

const prisma = new PrismaClient();

/** Adressen, die niemals in gepflegte Inhalte geschrieben werden dürfen. */
const NICHT_OEFFENTLICH = new Set(['0.0.0.0', '::', '[::]', '127.0.0.1', '[::1]', 'localhost']);

/** Felder, in denen gepflegte Adressen vorkommen können. */
type Ziel = {
  /** Name des Prisma-Modells, kleingeschrieben wie im Client. */
  modell: string;
  /** Anzeigename in der Vorschau. */
  label: string;
  /** Feld, das den Datensatz eindeutig benennt (`GlobalSetting` nutzt `key`). */
  schluessel: 'id' | 'key';
  /** Textfelder. */
  text?: string[];
  /** JSON-Felder; werden in der Tiefe durchsucht. */
  json?: string[];
};

const ZIELE: Ziel[] = [
  // Seiteninhalte: Entwurf, veröffentlichter Stand und die wiederherstellbaren
  // Versionen. Eine Version, die noch die alte Domain enthielte, brächte sie
  // beim Wiederherstellen zurück.
  { modell: 'pageSection', label: 'Seitenabschnitte (Entwurf)', schluessel: 'id', json: ['data'] },
  {
    modell: 'page',
    label: 'Seiten',
    schluessel: 'id',
    text: ['seoTitle', 'seoDescription', 'canonicalUrl'],
    json: ['publishedContent'],
  },
  { modell: 'pageVersion', label: 'Seitenversionen', schluessel: 'id', json: ['content'] },

  { modell: 'navigationItem', label: 'Menüpunkte', schluessel: 'id', text: ['href', 'label'] },

  {
    modell: 'tournament',
    label: 'Turniere',
    schluessel: 'id',
    text: [
      'summary',
      'description',
      'rules',
      'prizeInfo',
      'registrationUrl',
      'streamUrl',
      'discordUrl',
      'resultSummary',
      'recapUrl',
      'seoTitle',
      'seoDescription',
    ],
  },

  { modell: 'sponsor', label: 'Partner', schluessel: 'id', text: ['shortDescription', 'description', 'websiteUrl'] },
  { modell: 'sponsorTier', label: 'Partnerstufen', schluessel: 'id', text: ['description'] },

  { modell: 'socialAccount', label: 'Social-Accounts', schluessel: 'id', text: ['profileUrl', 'description'] },
  { modell: 'socialPost', label: 'Social-Beiträge', schluessel: 'id', text: ['title', 'excerpt', 'url'] },

  { modell: 'teamMember', label: 'Teammitglieder', schluessel: 'id', text: ['description'] },
  { modell: 'contactCategory', label: 'Kontaktkategorien', schluessel: 'id', text: ['description'] },
  { modell: 'mediaAsset', label: 'Medien', schluessel: 'id', text: ['alt', 'title', 'description'] },

  { modell: 'emailTemplate', label: 'E-Mail-Vorlagen', schluessel: 'id', text: ['subject', 'bodyMarkdown'] },
  { modell: 'redirect', label: 'Weiterleitungen', schluessel: 'id', text: ['destination', 'note'] },
  { modell: 'featureFlag', label: 'Feature-Schalter', schluessel: 'key', text: ['description'] },

  // Einstellungen liegen als JSON; betroffen sind etwa Fusstext, rechtliche
  // Angaben und SEO-Vorgaben.
  { modell: 'globalSetting', label: 'Einstellungen', schluessel: 'key', json: ['value'] },
];

/**
 * Zugriff auf die Modelle über ihren Namen.
 *
 * Prisma bildet jedes Modell einzeln typisiert ab; für einen Durchlauf über
 * eine Liste von Modellnamen gibt es keine typsichere Form. Die Umdeutung ist
 * bewusst auf diese eine Stelle begrenzt. Ein Tippfehler in der Liste oben
 * bleibt trotzdem nicht unbemerkt: Prisma lehnt ein unbekanntes Modell oder
 * Feld beim `select` mit einer klaren Meldung ab – und zwar in der Vorschau,
 * bevor irgendetwas geschrieben wird.
 */
type Delegat = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  update: (args: unknown) => Promise<unknown>;
};

function delegat(modell: string): Delegat {
  const client = prisma as unknown as Record<string, Delegat | undefined>;
  const eintrag = client[modell];
  if (!eintrag) throw new Error(`Unbekanntes Modell „${modell}“.`);
  return eintrag;
}

type Treffer = {
  label: string;
  schluessel: string;
  feld: string;
  ausschnitt: string;
};

function argument(name: string, kurz?: string): string | null {
  const argv = process.argv.slice(2);
  const index = argv.findIndex((entry) => entry === `--${name}` || (kurz ? entry === `-${kurz}` : false));
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function hatSchalter(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

async function main(): Promise<void> {
  const anwenden = hatSchalter('anwenden') || hatSchalter('apply');

  const von = parseTarget(argument('von') ?? argument('from') ?? 'new.swisshub.gg');
  const nachEingabe = argument('nach') ?? argument('to') ?? process.env.APP_URL ?? 'https://swisshub.gg';
  const nach = parseTarget(nachEingabe);

  if (von.host === nach.host) {
    throw new Error(`Alte und neue Domain sind identisch (${von.host}). Nichts zu tun.`);
  }

  /*
    Eine Bind- oder Loopback-Adresse darf nie in gepflegte Inhalte geschrieben
    werden – sie landete sonst in Links, E-Mails und Vorschauen. Das passiert
    schnell, wenn auf dem Server noch die Entwicklungs-`APP_URL` steht; deshalb
    steht die Prüfung vor dem ersten Lesezugriff und nicht erst vor dem
    Schreiben.
  */
  if (NICHT_OEFFENTLICH.has(new URL(nach.origin).hostname.toLowerCase())) {
    throw new Error(
      `„${nach.origin}“ ist keine öffentliche Adresse. Setze APP_URL auf die produktive Domain ` +
        'oder gib das Ziel ausdrücklich an:  npm run domain:migrate -- --nach https://swisshub.gg',
    );
  }

  const rewrite: DomainRewrite = { fromHost: von.host, toOrigin: nach.origin };

  console.info(`Domainwechsel: ${von.host} → ${nach.origin}`);
  console.info(anwenden ? 'Modus: ÄNDERN\n' : 'Modus: Vorschau (es wird nichts geschrieben)\n');

  if (anwenden) {
    console.info('Vor dem Ausführen eine Sicherung erstellen:  ./scripts/backup.sh\n');
  }

  const treffer: Treffer[] = [];
  let geaendert = 0;

  for (const ziel of ZIELE) {
    const felder = [...(ziel.text ?? []), ...(ziel.json ?? [])];
    const select = Object.fromEntries([[ziel.schluessel, true], ...felder.map((feld) => [feld, true])]);

    const rows = await delegat(ziel.modell).findMany({ select });

    for (const row of rows) {
      const schluessel = String(row[ziel.schluessel]);
      const patch: Record<string, unknown> = {};

      for (const feld of ziel.text ?? []) {
        const wert = row[feld];
        if (typeof wert !== 'string' || !containsHost(wert, von.host)) continue;

        patch[feld] = rewriteText(wert, rewrite);
        treffer.push({
          label: ziel.label,
          schluessel,
          feld,
          ausschnitt: excerptAround(wert, von.host) ?? wert,
        });
      }

      for (const feld of ziel.json ?? []) {
        const wert = row[feld];
        if (wert === null || wert === undefined) continue;

        const roh = JSON.stringify(wert);
        if (!containsHost(roh, von.host)) continue;

        patch[feld] = rewriteJson(wert, rewrite);
        treffer.push({
          label: ziel.label,
          schluessel,
          feld,
          ausschnitt: excerptAround(roh, von.host) ?? '',
        });
      }

      if (Object.keys(patch).length === 0) continue;
      geaendert += 1;

      if (anwenden) {
        await delegat(ziel.modell).update({ where: { [ziel.schluessel]: schluessel }, data: patch });
      }
    }
  }

  if (treffer.length === 0) {
    console.info(`Keine gespeicherten Adressen auf ${von.host} gefunden. Es gibt nichts zu tun.`);
    return;
  }

  console.info('Betroffene Datensätze:\n');
  let letztes = '';
  for (const eintrag of treffer) {
    if (eintrag.label !== letztes) {
      console.info(`  ${eintrag.label}`);
      letztes = eintrag.label;
    }
    console.info(`    ${eintrag.schluessel} · ${eintrag.feld}: ${eintrag.ausschnitt}`);
  }

  console.info(`\n${treffer.length} Fundstelle(n) in ${geaendert} Datensatz/Datensätzen.`);

  if (anwenden) {
    console.info('\nGeschrieben. Anschliessend den Anwendungscontainer neu starten, damit der');
    console.info('Zwischenspeicher die neuen Inhalte lädt:  docker compose up -d app');
  } else {
    console.info('\nZum Ausführen erneut mit --anwenden starten – vorher sichern (./scripts/backup.sh).');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
