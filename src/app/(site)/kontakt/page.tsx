import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/site/ContactForm';
import { JsonLd } from '@/components/site/JsonLd';
import { Icons } from '@/components/ui/Icon';
import { PageHero } from '@/components/site/PageHero';
import { Reveal } from '@/components/visual/Reveal';
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

      <PageHero
        eyebrow="Kontakt"
        icon="mail"
        ghost="Kontakt"
        title="Schreib uns"
        lead="Ob Partnerschaft, Sponsoring, Medienanfrage oder ein technisches Problem auf der Website – hier bist du richtig. Wir melden uns so schnell wie möglich zurück."
      />

      <div className="shell section grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <Reveal className="panel corner-ticks relative overflow-hidden">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 tech-grid-fine opacity-40" />
          <div className="relative">
          <p className="meta-brand mb-2">Schriftliche Anfrage</p>
          <h2 className="heading-md mb-6">Kontaktformular</h2>
          <ContactForm
            categories={categories}
            defaultCategory={defaultCategory}
            attachmentsEnabled={settings.contactAttachmentsEnabled}
            maxUploadMb={config.MAX_UPLOAD_MB}
            captchaSiteKey={settings.contactCaptchaEnabled && config.captchaConfigured ? config.TURNSTILE_SITE_KEY : null}
          />
          </div>
        </Reveal>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="panel border-[color-mix(in_srgb,var(--color-brand)_40%,var(--color-line))] bg-[var(--color-brand-soft)]">
            <p className="meta-brand mb-3">Community-Support</p>
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
              <p className="meta mb-3">Direkter Draht</p>
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
              <h2 className="mb-4 text-base font-semibold text-[var(--color-ink)]">Kategorien</h2>
              <dl className="space-y-3">
                {categories.map((category) => (
                  <div key={category.key} className="border-l border-[var(--color-line-strong)] pl-3">
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
