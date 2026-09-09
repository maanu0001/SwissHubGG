import { PageHero } from '@/components/site/PageHero';
import { SectionLinkButton } from '@/components/sections/SectionLinkButton';
import type { CmsPageHeader } from '@/lib/content/pageHeader';
import { getSettings } from '@/lib/settings';

/**
 * Kopfbereich der über den Website-Builder gepflegten Seiten.
 *
 * Dünne Schicht über `PageHero`: Sie übersetzt die gepflegten Angaben in
 * dessen Eigenschaften und füllt fehlende Werte mit neutralen Vorgaben. Das
 * Aussehen selbst kommt vollständig aus `PageHero`, damit dynamische Seiten
 * und fest gebaute Seiten nicht auseinanderlaufen können.
 *
 * Es wird nichts erfunden: Ohne gepflegtes Label steht der Name der Website
 * dort, ohne Einleitung entfällt der Absatz ersatzlos. Das Symbol stammt aus
 * dem vorhandenen Symbolsatz.
 */
export async function CmsPageHero({ header }: { header: CmsPageHeader }) {
  const settings = await getSettings();

  return (
    <PageHero
      eyebrow={header.eyebrow || settings.siteName}
      icon="swiss"
      ghost={settings.siteName}
      title={header.title}
      lead={header.lead || undefined}
    >
      {header.motto || header.primaryLink || header.secondaryLink ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {header.motto ? (
            <p className="inline-flex items-center gap-2.5 rounded-full border border-[color-mix(in_srgb,var(--color-brand)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-brand-soft)_75%,transparent)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-text)] backdrop-blur-sm">
              <span className="pulse-dot h-1.5 w-1.5" />«{header.motto}»
            </p>
          ) : null}

          {header.primaryLink ? <SectionLinkButton link={header.primaryLink} /> : null}
          {header.secondaryLink ? (
            <SectionLinkButton link={header.secondaryLink} fallbackStyle="secondary" />
          ) : null}
        </div>
      ) : null}
    </PageHero>
  );
}
