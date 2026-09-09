import type { Metadata } from 'next';
import { SectionRenderer } from '@/components/sections/SectionRenderer';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPublishedPage } from '@/lib/content/queries';
import { buildMetadata } from '@/lib/seo';

/** Startseite. Der Inhalt wird vollständig über den Website-Builder gepflegt. */

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublishedPage('home');

  return buildMetadata({
    title: page?.seoTitle ?? null,
    description: page?.seoDescription ?? null,
    path: '/',
    imageKey: page?.seoImageKey ?? null,
    noIndex: page?.seoNoIndex ?? false,
    canonicalOverride: page?.canonicalUrl ?? null,
  });
}

export default async function HomePage() {
  const page = await getPublishedPage('home');

  if (!page || page.sections.length === 0) {
    return (
      <div className="shell section">
        <EmptyState
          title="Die Startseite ist noch nicht veröffentlicht"
          description="Im Admin-Dashboard kann die Startseite zusammengestellt und veröffentlicht werden. Bis dahin siehst du diesen Hinweis."
          action={{ href: '/kontakt', label: 'Kontakt aufnehmen' }}
        />
      </div>
    );
  }

  return <SectionRenderer sections={page.sections} />;
}
