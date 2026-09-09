import type { RenderableSection } from '@/lib/content/sections';

/**
 * Kopfbereich einer über den Website-Builder gepflegten Seite.
 *
 * Jede CMS-Seite ausser der Startseite beginnt mit demselben Kopfbereich wie
 * die fest gebauten Unterseiten. Dafür wird kein neues Feld im CMS gebraucht:
 * Führt eine Seite bereits einen Auftaktblock, liefert dieser die Angaben –
 * seine Eingabefelder heissen dort schon Label, Hauptaussage und Text. Fehlt
 * er, genügt der Seitentitel.
 *
 * Der Auftaktblock wird dadurch nicht zusätzlich ausgegeben, sondern *ist* der
 * Kopfbereich. Inhalte gehen nicht verloren – Motto und Schaltflächen wandern
 * mit. Der grosse Auftritt mit der Bildmarke bleibt allein der Startseite
 * vorbehalten.
 */

export type CmsPageHeader = {
  /** Kategorie-Label; leer, wenn nichts gepflegt ist. */
  eyebrow: string;
  title: string;
  lead: string;
  motto: string;
  primaryLink: Extract<RenderableSection, { type: 'HERO' }>['data']['primaryLink'];
  secondaryLink: Extract<RenderableSection, { type: 'HERO' }>['data']['secondaryLink'];
};

export type PageHeaderSplit = {
  header: CmsPageHeader;
  /** Die verbleibenden Abschnitte – ohne den zum Kopfbereich gewordenen Block. */
  sections: RenderableSection[];
};

/**
 * Trennt den Kopfbereich vom übrigen Inhalt.
 *
 * @param title Titel der Seite, als Rückfall für die Überschrift.
 */
export function splitPageHeader(sections: RenderableSection[], title: string): PageHeaderSplit {
  const intro = sections.find((section) => section.visible);

  if (intro?.type === 'HERO') {
    return {
      header: {
        eyebrow: intro.data.eyebrow.trim(),
        title: intro.data.headline.trim() || title,
        lead: intro.data.text.trim(),
        motto: intro.data.motto.trim(),
        primaryLink: intro.data.primaryLink,
        secondaryLink: intro.data.secondaryLink,
      },
      sections: sections.filter((section) => section !== intro),
    };
  }

  return {
    header: { eyebrow: '', title, lead: '', motto: '', primaryLink: null, secondaryLink: null },
    sections,
  };
}
