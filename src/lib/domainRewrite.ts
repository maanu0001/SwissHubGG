/**
 * Umschreiben gespeicherter Adressen beim Wechsel der Domain.
 *
 * Die Anwendung selbst erzeugt alle absoluten Adressen aus `APP_URL` – ein
 * Domainwechsel ist dort eine reine Konfigurationsänderung. Was **nicht**
 * mitwandert, sind Adressen, die jemand in gepflegte Inhalte geschrieben hat:
 * Links in Seitenabschnitten, E-Mail-Vorlagen, Menüpunkten oder Einstellungen.
 * Genau diese Stellen schreibt `scripts/migrate-domain.ts` mit den Funktionen
 * hier um.
 *
 * Zwei Zusicherungen prägen die Regeln:
 *
 * - **Nur der eine Host.** Andere Subdomains (`system.swisshub.gg`,
 *   `sponsoring.swisshub.gg`) und fremde Adressen bleiben unberührt. Deshalb
 *   ist der Treffer beidseitig begrenzt: Weder darf links ein Namensteil
 *   stehen (`alt-new.swisshub.gg`, `system.new.swisshub.gg`) noch rechts
 *   (`new.swisshub.gg.example.com`).
 * - **Nur Adressen.** Pfad, Suchparameter und Sprungmarke bleiben erhalten,
 *   weil ausschliesslich Protokoll und Host ersetzt werden. E-Mail-Adressen
 *   (`info@new.swisshub.gg`) bleiben stehen: Sie sind keine Website-Adressen,
 *   und der Postfachwechsel ist eine eigene Entscheidung.
 *
 * Die Funktionen sind rein und mehrfach anwendbar: Ein zweiter Durchlauf
 * findet nichts mehr.
 */

export type DomainRewrite = {
  /** Alter Hostname, z. B. `new.swisshub.gg` – ohne Protokoll. */
  fromHost: string;
  /** Neuer Ursprung, z. B. `https://swisshub.gg`. */
  toOrigin: string;
};

/** Maskiert einen Hostnamen für die Verwendung in einem regulären Ausdruck. */
function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalisiert eine Eingabe zu Hostname und Ursprung.
 *
 * Angenommen werden beide Schreibweisen – `swisshub.gg` und
 * `https://swisshub.gg` –, damit die Bedienung des Skripts nicht davon abhängt.
 */
export function parseTarget(value: string): { host: string; origin: string } {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) throw new Error('Die Angabe ist leer.');

  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`„${value}“ enthält einen Pfad. Erwartet wird nur die Domain, z. B. https://swisshub.gg.`);
  }

  return { host: url.host, origin: url.origin };
}

/** Beide Muster, mit denen der alte Host in einem Text vorkommen kann. */
function patterns(fromHost: string): { withScheme: RegExp; bare: RegExp } {
  const host = escapeForPattern(fromHost);

  return {
    // Vollständige und protokollrelative Adressen: `https://host`, `//host`.
    withScheme: new RegExp(`(?:https?:)?//${host}(?![\\w.-])`, 'gi'),
    // Blosse Nennung im Fliesstext. Links darf kein Namens-, Pfad- oder
    // Postfachzeichen stehen, rechts kein weiterer Namensteil.
    bare: new RegExp(`(?<![\\w.@/-])${host}(?![\\w.-])`, 'gi'),
  };
}

/**
 * Schreibt alle Vorkommen des alten Hosts in einem Text um.
 *
 * Adressen bekommen den vollständigen neuen Ursprung, blosse Nennungen im
 * Fliesstext nur den neuen Hostnamen – ein Text bleibt dadurch ein Text.
 */
export function rewriteText(text: string, rewrite: DomainRewrite): string {
  const { host: toHost } = parseTarget(rewrite.toOrigin);
  const { withScheme, bare } = patterns(rewrite.fromHost);

  return text.replace(withScheme, rewrite.toOrigin.replace(/\/+$/, '')).replace(bare, toHost);
}

/** Ob ein Text den alten Host überhaupt enthält. */
export function containsHost(text: string, fromHost: string): boolean {
  const { withScheme, bare } = patterns(fromHost);
  return withScheme.test(text) || bare.test(text);
}

/**
 * Wie `rewriteText`, aber für beliebige JSON-Werte.
 *
 * Abschnittsdaten und Einstellungen liegen als JSON in der Datenbank. Ersetzt
 * werden ausschliesslich Zeichenketten in den Werten – Schlüssel, Zahlen,
 * Wahrheitswerte und `null` bleiben unangetastet.
 */
export function rewriteJson(value: unknown, rewrite: DomainRewrite): unknown {
  if (typeof value === 'string') return rewriteText(value, rewrite);
  if (Array.isArray(value)) return value.map((entry) => rewriteJson(entry, rewrite));

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, rewriteJson(entry, rewrite)]),
    );
  }

  return value;
}

/**
 * Kurzer Ausschnitt um die erste Fundstelle – für die Vorschau.
 *
 * Zeigt, was tatsächlich getroffen wird, ohne ganze Seiteninhalte auszugeben.
 */
export function excerptAround(text: string, fromHost: string, padding = 34): string | null {
  const { withScheme, bare } = patterns(fromHost);

  const first = [withScheme, bare]
    .map((pattern) => {
      pattern.lastIndex = 0;
      return pattern.exec(text);
    })
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => a.index - b.index)[0];

  if (!first) return null;

  const start = Math.max(0, first.index - padding);
  const end = Math.min(text.length, first.index + first[0].length + padding);

  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}
