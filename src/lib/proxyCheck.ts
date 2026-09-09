import 'server-only';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/**
 * Prüft, ob der Reverse Proxy den öffentlichen Host durchreicht.
 *
 * Warum das zählt: Next.js nimmt eine Server Action nur an, wenn der
 * `Origin`-Kopf zum Host der Anfrage passt. Reicht der Proxy den
 * ursprünglichen Host nicht weiter, sieht die Anwendung ihre interne Adresse
 * (z. B. `127.0.0.1:3001`), der Browser sendet aber die öffentliche – und
 * jedes Speichern im Dashboard scheitert, ohne dass ein Formularfehler
 * sichtbar würde.
 *
 * Die richtige Einstellung ist beim Proxy, nicht in der Anwendung:
 *
 * - Apache: `ProxyPreserveHost On`
 * - Nginx: `proxy_set_header Host $host;`
 *
 * Zusätzlich ist die öffentliche Domain aus `APP_URL` in `next.config.ts`
 * ausdrücklich erlaubt. Diese Prüfung macht eine Fehlkonfiguration trotzdem
 * sichtbar, statt sie nur abzufangen.
 */

export type ProxyCheck = {
  /** Host, den die Anwendung sieht. */
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  forwardedFor: boolean;
  /** Host aus `APP_URL` – so ist die Website öffentlich erreichbar. */
  expectedHost: string;
  matches: boolean;
  hint: string | null;
};

export async function checkProxyHeaders(): Promise<ProxyCheck> {
  const headerList = await headers();

  const host = headerList.get('host');
  const forwardedHost = headerList.get('x-forwarded-host');
  const effective = forwardedHost ?? host;
  const expectedHost = new URL(env().APP_URL).host;

  const matches = effective === expectedHost;

  return {
    host,
    forwardedHost,
    forwardedProto: headerList.get('x-forwarded-proto'),
    forwardedFor: headerList.get('x-forwarded-for') !== null,
    expectedHost,
    matches,
    hint: matches
      ? null
      : `Die Anwendung sieht „${effective ?? 'keinen Host'}“, erwartet wird „${expectedHost}“. Setze im Reverse Proxy „ProxyPreserveHost On“ (Apache) beziehungsweise „proxy_set_header Host $host;“ (Nginx) – oder korrigiere APP_URL.`,
  };
}
