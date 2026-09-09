'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Datenschutzhinweis.
 *
 * Die Website setzt keine Cookies zu Marketing- oder Trackingzwecken. Dieser
 * Hinweis ist deshalb optional und im Dashboard abschaltbar. Er verwendet keine
 * Dark Patterns: Ablehnen ist genauso leicht erreichbar wie Zustimmen, und die
 * Entscheidung wird nur lokal im Browser gespeichert.
 */

const STORAGE_KEY = 'swisshub.privacy-notice';

export function CookieNotice({ policyVersion }: { policyVersion: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      setVisible(stored !== policyVersion);
    } catch {
      // Bei blockiertem Speicher wird der Hinweis einmalig pro Sitzung angezeigt.
      setVisible(true);
    }
  }, [policyVersion]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, policyVersion);
    } catch {
      // Ohne Speicher bleibt der Hinweis beim nächsten Besuch erneut sichtbar.
    }
    setVisible(false);
  };

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
