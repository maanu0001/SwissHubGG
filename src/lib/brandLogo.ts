/**
 * Das Hauptlogo der Website.
 *
 * Gepflegt wird es im Dashboard unter *Einstellungen → Darstellung*. Ist dort
 * nichts gewählt – oder das gewählte Medium nicht mehr vorhanden – gilt die
 * mitgelieferte Bildmarke.
 *
 * Die tatsächlichen Abmessungen reisen mit. Nur so lässt sich ein eigenes Logo
 * überall proportional darstellen: Es wird an einer Kante ausgerichtet und die
 * andere ergibt sich daraus. Gestaucht, verzerrt oder beschnitten wird es nie.
 *
 * Bewusst ein eigenes, abhängigkeitsfreies Modul: Die Angaben werden auf dem
 * Server ermittelt (`@/lib/siteLogo`), aber auch in Client-Komponenten wie der
 * mobilen Navigation gebraucht.
 */

export type SiteLogo = {
  /** Quelle des Bildes – mitgelieferte Datei oder Medienbibliothek. */
  src: string;
  /** Tatsächliche Breite in Pixeln; hält das Seitenverhältnis fest. */
  width: number;
  /** Tatsächliche Höhe in Pixeln. */
  height: number;
  /** Alternativtext; entspricht dem Namen der Website. */
  alt: string;
};

/** Die mitgelieferte Bildmarke – immer vorhanden, immer quadratisch. */
export const DEFAULT_LOGO: SiteLogo = {
  src: '/brand/swisshub-logo-256.png',
  width: 256,
  height: 256,
  alt: 'SwissHub',
};
