import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/site/ContactForm';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo';
import { safeUrl } from '@/lib/sanitize';

/**
 * Kontaktseite.
 *
 * Community-Support läuft bewusst über das Discord-Ticketsystem; dieses
 * Formular ist für Anfragen gedacht, die schriftlich und nachvollziehbar
 * bearbeitet werden sollen.
 */

type PageProps = { searchParams: Promise<{ kategorie?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Kontakt zu SwissHub',
    description:
      'Anfragen zu Partnerschaften, Sponsoring, Turnieren, Medien und mehr. Community-Support läuft über unser Discord-Ticketsystem.',
    path: '/kontakt',
  });
}

export default async function ContactPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [categories, settings] = await Promise.all([
    prisma.contactCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { key: true, label: true, description: true },
    }),
    getSettings(),
  ]);

  const defaultCategory = categories.find((category) => category.key === params.kategorie)?.key;
  const discordUrl = safeUrl(settings.discordInviteUrl);
  const config = env();

  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: 'Start', path: '/' }, { name: 'Kontakt', path: '/kontakt' }])} />

      <section className="border-b border-[var(--color-line)] hero-veil">
        <div className="shell py-14 sm:py-20">
          <p className="eyebrow">
            <Icons.chat size={14} />
            Kontakt
          </p>
          <h1 className="heading-xl max-w-2xl">Schreib uns</h1>
          <p className="lead mt-4 max-w-2xl">
            Ob Partnerschaft, Sponsoring, Medienanfrage oder ein technisches Problem auf der Website – hier bist du
            richtig. Wir melden uns so schnell wie möglich zurück.
          </p>
        </div>
      </section>

      <div className="shell section grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="panel">
          <h2 className="heading-md mb-6">Kontaktformular</h2>
          <ContactForm
            categories={categories}
            defaultCategory={defaultCategory}
            attachmentsEnabled={settings.contactAttachmentsEnabled}
            maxUploadMb={config.MAX_UPLOAD_MB}
            captchaSiteKey={settings.contactCaptchaEnabled && config.captchaConfigured ? config.TURNSTILE_SITE_KEY : null}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="panel">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-[var(--color-ink)]">
              <Icons.discord size={18} className="text-[var(--color-brand-text)]" />
              Support über Discord
            </h2>
            <p className="muted mb-4">
              Fragen zur Community, zu deinem Account oder zu laufenden Turnieren klärst du am schnellsten über unser
              Ticketsystem auf dem Discord.
            </p>
            {discordUrl ? (
              <a
                href={discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-track-social="DISCORD"
                className="btn-secondary w-full"
              >
                Zum Discord-Support
                <Icons.external size={13} />
              </a>
            ) : (
              <p className="text-sm text-[var(--color-ink-subtle)]">
                Der Discord-Einladungslink wird derzeit aktualisiert.
              </p>
            )}
          </div>

          {settings.contactEmail ? (
            <div className="panel">
              <h2 className="mb-2 text-base font-semibold text-[var(--color-ink)]">E-Mail</h2>
              <p className="muted mb-3">Du schreibst uns lieber direkt?</p>
              <a
                href={`mailto:${settings.contactEmail}`}
                className="text-sm font-semibold text-[var(--color-brand-text)] underline underline-offset-2 hover:text-[var(--color-ink)]"
              >
                {settings.contactEmail}
              </a>
            </div>
          ) : null}

          {categories.length > 0 ? (
            <div className="panel">
              <h2 className="mb-3 text-base font-semibold text-[var(--color-ink)]">Kategorien</h2>
              <dl className="space-y-3">
                {categories.map((category) => (
                  <div key={category.key}>
                    <dt className="text-sm font-medium text-[var(--color-ink)]">{category.label}</dt>
                    {category.description ? (
                      <dd className="text-xs leading-relaxed text-[var(--color-ink-subtle)]">{category.description}</dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="panel">
            <h2 className="mb-2 text-base font-semibold text-[var(--color-ink)]">Datenschutz</h2>
            <p className="muted">
              Deine Angaben nutzen wir ausschliesslich zur Bearbeitung deiner Anfrage. Details findest du in der{' '}
              <Link href="/datenschutz" className="text-[var(--color-brand-text)] underline underline-offset-2">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
