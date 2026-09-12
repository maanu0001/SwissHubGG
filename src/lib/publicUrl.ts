import { env } from '@/lib/env';

/**
 * Öffentliche Adressen der Website.
 *
 * Warum es diese Stelle gibt: In einem Route Handler ist `request.url` die
 * Adresse, unter der die **Anwendung** die Anfrage entgegengenommen hat – hinter
 * einem Reverse Proxy also die interne. Bindet der Server auf `0.0.0.0:3000`,
 * steht genau das in `request.url`, und eine daraus gebaute Weiterleitung
 * schickt Besucherinnen und Besucher an `http://0.0.0.0:3000/…`. Das ist keine
 * erreichbare Adresse, sondern eine Bind-Adresse.
 *
 * Deshalb werden öffentliche Weiterleitungen ausschliesslich aus `APP_URL`
 * gebaut. Diese Variable ist die einzige Quelle der öffentlichen Adresse und
 * bleibt konfigurierbar – ein späterer Wechsel der Domain ist damit eine reine
 * Konfigurationsänderung.
 */

/** Adressen, die niemals öffentlich ausgeliefert werden dürfen. */
const NON_PUBLIC_HOSTS = new Set(['0.0.0.0', '::', '[::]', '127.0.0.1', '[::1]', 'localhost']);

let warned = false;

function isNonPublic(hostname: string): boolean {
  return NON_PUBLIC_HOSTS.has(hostname.toLowerCase());
}

/**
 * Der öffentliche Ursprung der Website.
 *
 * Regelfall ist `APP_URL`. Ist dort eine Bind- oder Loopback-Adresse hinterlegt
 * – etwa weil die Variable auf dem Server noch fehlt –, wird als Notnagel der
 * vom Reverse Proxy gemeldete Host verwendet, sofern diesem vertraut wird
 * (`TRUST_PROXY`). So erscheint `0.0.0.0` auch bei einer unvollständigen
 * Konfiguration nie in einer Weiterleitung.
 */
export function publicOrigin(headers?: Headers): string {
  const config = env();
  const configured = new URL(config.APP_URL);

  if (!isNonPublic(configured.hostname)) return configured.origin;

  const forwardedHost = config.TRUST_PROXY
    ? (headers?.get('x-forwarded-host') ?? headers?.get('host') ?? null)
    : null;

  if (forwardedHost && !isNonPublic(forwardedHost.split(':')[0] ?? '')) {
    const proto = headers?.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';

    if (!warned) {
      warned = true;
      console.warn(
        `[publicUrl] APP_URL zeigt auf „${configured.host}“ und ist damit keine öffentliche Adresse. ` +
          `Es wird ersatzweise der vom Proxy gemeldete Host verwendet. Bitte APP_URL auf die öffentliche Adresse setzen.`,
      );
    }

    return `${proto}://${forwardedHost}`;
  }

  return configured.origin;
}

/**
 * Baut eine absolute Adresse für einen **internen** Pfad.
 *
 * Alles, was keine interne Adresse ist – vollständige URLs, protokollrelative
 * Angaben wie `//fremde-domain`, Zeilenumbrüche –, wird verworfen und durch
 * `fallback` ersetzt. Damit kann aus einem übergebenen Ziel keine Weiterleitung
 * auf eine fremde Domain werden.
 */
export function internalUrl(path: string, headers?: Headers, fallback = '/'): URL {
  return new URL(safeInternalPath(path, fallback), publicOrigin(headers));
}

/** Prüft einen Pfad auf eine gefahrlose, interne Form. */
export function safeInternalPath(path: string | null | undefined, fallback = '/'): string {
  if (typeof path !== 'string') return fallback;

  const value = path.trim();
  if (!value.startsWith('/')) return fallback;
  // `//host` und `/\host` sind protokollrelative Adressen auf fremde Hosts.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  // Steuerzeichen könnten den Location-Kopf aufbrechen.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;

  return value;
}
