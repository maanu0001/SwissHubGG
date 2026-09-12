import { NextResponse, type NextRequest } from 'next/server';
import { internalUrl } from '@/lib/publicUrl';

/**
 * Setzt die Content-Security-Policy mit einer Nonce pro Request und schützt den
 * Admin-Bereich vor unnötigem Rendern.
 *
 * Die eigentliche Autorisierung passiert immer serverseitig in der jeweiligen
 * Route bzw. Server Action. Die Prüfung hier verhindert lediglich, dass ohne
 * Sitzungscookie überhaupt eine Admin-Seite aufgebaut wird.
 */

const SESSION_COOKIE = 'swisshub_session';

/** Pfade im Admin-Bereich, die ohne Anmeldung erreichbar sein müssen. */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/login/start', '/admin/login/callback', '/admin/kein-zugriff'];

function buildCsp(nonce: string, isProduction: boolean): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${
      isProduction ? '' : " 'unsafe-eval'"
    }`,
    // Next.js und Tailwind erzeugen eingebettete Stile; Stil-Injektion ist durch
    // die strikte Sanitisierung der Inhalte kein realistischer Angriffsvektor.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.discordapp.com",
    "font-src 'self'",
    "connect-src 'self'",
    // Externe Player werden erst nach ausdrücklicher Interaktion geladen.
    "frame-src https://www.youtube-nocookie.com https://player.twitch.tv https://clips.twitch.tv https://challenges.cloudflare.com",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (isProduction) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'production');

  const isProtectedAdminPath =
    pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.some((allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`));

  if (isProtectedAdminPath && !request.cookies.get(SESSION_COOKIE)) {
    // Aus der öffentlichen Adresse gebaut, nicht aus `request.url`: Letzteres
    // ist hinter dem Reverse Proxy die interne Adresse der Anwendung.
    const loginUrl = internalUrl('/admin/login', request.headers);
    loginUrl.searchParams.set('next', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set('Content-Security-Policy', csp);
    return redirectResponse;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);

  // Admin- und Vorschauseiten dürfen niemals indexiert oder zwischengespeichert werden.
  if (pathname.startsWith('/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
}

export const config = {
  // Statische Assets brauchen weder Nonce noch Admin-Prüfung.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|fonts/).*)'],
};
