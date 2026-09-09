'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';

/**
 * Datenschutzhinweis.
 *
 * Die Website setzt keine Cookies zu Marketing- oder Trackingzwecken. Dieser
 * Hinweis ist deshalb optional und im Dashboard abschaltbar. Er verwendet keine
 * Dark Patterns: Die Bestätigung ist ein einzelner Klick, die Entscheidung wird
 * ausschliesslich lokal im Browser gespeichert und nie an den Server gesendet.
 */

const STORAGE_KEY = 'swisshub.privacy-notice';
const CHANGE_EVENT = 'swisshub:privacy-notice';

/**
 * Der gespeicherte Wert wird über `useSyncExternalStore` gelesen. Damit gibt es
 * keinen zusätzlichen Renderdurchlauf und kein Aufblitzen des Hinweises.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Ist der Speicher blockiert, gilt der Hinweis als noch nicht bestätigt.
    return null;
  }
}

/** Auf dem Server ist nichts bekannt – der Hinweis erscheint erst nach der Hydration. */
function getServerSnapshot(): string | null {
  return null;
}

export function CookieNotice({ policyVersion }: { policyVersion: string }) {
  const acknowledged = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, policyVersion);
    } catch {
      // Ohne Speicher bleibt der Hinweis beim nächsten Besuch erneut sichtbar.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [policyVersion]);

  if (acknowledged === policyVersion) return null;

  return (
    <div
      role="region"
      aria-label="Datenschutzhinweis"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-[var(--radius-card)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-raised)] sm:inset-x-6 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
          Diese Website verwendet nur technisch notwendige Speicherfunktionen. Externe Inhalte wie YouTube
          oder Twitch werden erst geladen, wenn du sie ausdrücklich startest. Mehr dazu in der{' '}
          <Link href="/datenschutz" className="text-[var(--color-brand-text)] underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <button type="button" onClick={dismiss} className="btn-primary shrink-0">
          Verstanden
        </button>
      </div>
    </div>
  );
}
