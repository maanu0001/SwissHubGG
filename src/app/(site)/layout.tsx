import { headers } from 'next/headers';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Analytics } from '@/components/site/Analytics';
import { CookieNotice } from '@/components/site/CookieNotice';
import { MaintenanceScreen } from '@/components/site/MaintenanceScreen';
import { MotionRuntime } from '@/components/visual/MotionRuntime';
import { getSocialAccounts } from '@/lib/content/queries';
import { getSettings } from '@/lib/settings';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth/session';

/**
 * Layout der öffentlichen Website.
 *
 * Enthält den Sprunglink, den gemeinsamen Rahmen und die strukturierten Daten
 * für Organisation und Website. Ist der Wartungsmodus aktiv, sehen nur
 * angemeldete Admin-Benutzer die reguläre Seite.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, accounts, headerList] = await Promise.all([getSettings(), getSocialAccounts(), headers()]);

  if (settings.maintenanceMode) {
    const user = await getCurrentUser();
    if (!user) {
      return <MaintenanceScreen message={settings.maintenanceMessage} />;
    }
  }

  const nonce = headerList.get('x-nonce') ?? undefined;
  const socialUrls = accounts.map((account) => account.profileUrl).filter(Boolean);

  const jsonLd = [await organizationJsonLd(socialUrls), await websiteJsonLd()];

  return (
    <>
      {/* Muss vor dem ersten Zeichnen laufen, damit nichts aufblitzt. */}
      <MotionRuntime />

      <a href="#inhalt" className="skip-link">
        Direkt zum Inhalt
      </a>

      {settings.maintenanceMode ? (
        <p className="bg-[var(--color-warning)] px-4 py-2 text-center text-sm font-medium text-black">
          Wartungsmodus aktiv – diese Ansicht ist nur für angemeldete Admin-Benutzer sichtbar.
        </p>
      ) : null}

      <SiteHeader />

      <main id="inhalt" className="flex-1">
        {children}
      </main>

      <SiteFooter />

      {settings.cookieBannerEnabled ? <CookieNotice policyVersion={settings.cookiePolicyVersion} /> : null}
      {env().METRICS_ENABLED ? <Analytics /> : null}

      <script
        type="application/ld+json"
        nonce={nonce}
        // Die Daten stammen ausschliesslich aus geprüften Servereinstellungen.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
