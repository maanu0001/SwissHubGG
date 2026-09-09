/**
 * Entscheidung, ob die Einfluganimation einer Seite gespielt wird.
 *
 * Die Einblendungen beim Seitenaufbau (`[data-reveal]`) sind ein Auftritt, kein
 * Dauerzustand: Sie sollen den Wechsel von der Startseite in einen Bereich
 * begleiten und danach nicht mehr stören. Deshalb entscheidet ausschliesslich
 * die **unmittelbar vorherige** interne Route – nicht der Verlauf, nicht ein
 * Merker und nicht `document.referrer`.
 *
 * Der Zustand wird als Attribut am `<html>`-Element geführt. Das CSS blendet
 * Inhalte nur dann zu Beginn aus, wenn dort `on` steht; ohne das Attribut ist
 * alles sofort sichtbar. Dadurch ist der ruhige Zustand der Normalfall –
 * Direktaufruf, Neuladen, neuer Tab und externe Verweise brauchen keine
 * Sonderbehandlung.
 */

/** Attribut am `<html>`-Element, das den Zustand für das CSS führt. */
export const INTRO_ATTRIBUTE = 'data-intro';

/** Der einzige Pfad, von dem aus eine Einfluganimation ausgelöst wird. */
export const HOME_PATH = '/';

export type IntroState = 'on' | 'off';

type IntroInput = {
  /** Pfad der Route, die gerade aufgebaut wird. */
  to: string;
  /**
   * Pfad der unmittelbar zuvor angezeigten internen Route.
   *
   * `null` steht für „keine bekannte Vorgängerroute“ – also Erstaufruf,
   * Neuladen, neuer Tab oder ein Verweis von aussen.
   */
  from: string | null;
  /** Systemeinstellung „Bewegung reduzieren“. Hat immer Vorrang. */
  reducedMotion?: boolean;
};

/**
 * Die Regel in einer Zeile: Es wird eingeblendet, wenn die Startseite an dem
 * Wechsel beteiligt ist.
 *
 * - Startseite → Unterseite: die Unterseite blendet ein.
 * - Unterseite → Startseite: die Startseite behält ihren eigenen Auftritt.
 * - Unterseite → Unterseite: nichts blendet ein.
 * - Ohne bekannte Vorgängerroute: nichts blendet ein; die Startseite ist
 *   davon ausgenommen, sie beginnt immer mit ihrem Auftritt.
 */
export function shouldPlayIntro({ to, from, reducedMotion = false }: IntroInput): boolean {
  if (reducedMotion) return false;
  if (to === HOME_PATH) return true;
  return from === HOME_PATH;
}

export function introState(input: IntroInput): IntroState {
  return shouldPlayIntro(input) ? 'on' : 'off';
}
