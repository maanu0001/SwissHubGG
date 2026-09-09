/**
 * Wann ein Seitenaufbau oben beginnen soll.
 *
 * Die Regel steht bewusst als reine Funktion hier und nicht verstreut in der
 * Komponente: Sie ist damit prüfbar und lässt sich nachlesen, ohne den
 * Router-Ablauf verstehen zu müssen.
 *
 * Entscheidend ist ausschliesslich der **Pfad**. Ein Filterwechsel wie
 * `/turniere?status=laufend` ist kein Seitenwechsel – dort bleibt die
 * Scrollposition, wo sie ist. Dasselbe gilt für Anker, Suchparameter und jedes
 * erneute Rendern derselben Route.
 */

type ScrollResetInput = {
  /** Pfad der Route, die gerade aufgebaut wird – ohne Suchparameter. */
  to: string;
  /**
   * Pfad der unmittelbar zuvor angezeigten Route.
   * `null` steht für den Erstaufruf; dort hat der Browser die Position bereits
   * gesetzt, auch bei einem geteilten Link mit Anker.
   */
  from: string | null;
  /** „Zurück“ oder „Vorwärts“: Die wiederhergestellte Position bleibt. */
  viaHistory?: boolean;
  /** Anker der Zieladresse, inklusive `#`. */
  hash?: string;
};

/** Der einzige Pfad, der ein eigenes Abschnittsverhalten hat. */
const HOME_PATH = '/';

export function shouldResetScroll({ to, from, viaHistory = false, hash = '' }: ScrollResetInput): boolean {
  // Erstaufruf: Die Position steht bereits fest.
  if (from === null) return false;

  // Kein Pfadwechsel – Filter, Suchparameter, Anker, erneutes Rendern.
  if (from === to) return false;

  // Zurück und Vorwärts: Die wiederhergestellte Position ist die erwartete.
  if (viaHistory) return false;

  // Ein Ankerlink auf die Startseite darf weiterhin zum Abschnitt springen.
  if (to === HOME_PATH && hash.length > 1) return false;

  return true;
}
