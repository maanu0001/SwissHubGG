'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Erhebt anonyme, aggregierte Nutzungszahlen.
 *
 * Es werden keine Cookies gesetzt, keine IDs vergeben und keine Daten an
 * Dritte gesendet. Übertragen werden ausschliesslich der Pfad der Seite bzw.
 * das Ziel eines Klicks. Der Server speichert daraus nur Tagessummen.
 */

type TrackEvent = { type: string; key: string };

function send(event: TrackEvent): void {
  try {
    const payload = JSON.stringify(event);
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch {
    // Statistik ist optional – Fehler bleiben ohne Auswirkung auf die Seite.
  }
}

export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;

    const type = pathname.startsWith('/turniere/') ? 'TOURNAMENT_VIEW' : 'PAGE_VIEW';
    send({ type, key: pathname });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const social = target.closest<HTMLElement>('[data-track-social]');
      if (social?.dataset.trackSocial) {
        const platform = social.dataset.trackSocial;
        send({ type: platform === 'DISCORD' ? 'DISCORD_CLICK' : 'SOCIAL_CLICK', key: platform });
        return;
      }

      const sponsor = target.closest<HTMLElement>('[data-track-sponsor]');
      if (sponsor?.dataset.trackSponsor) {
        send({ type: 'SPONSOR_CLICK', key: sponsor.dataset.trackSponsor });
      }
    };

    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
