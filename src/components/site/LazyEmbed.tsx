'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/Icon';

/**
 * Externe Videos werden erst nach ausdrücklicher Zustimmung geladen.
 *
 * Bis dahin wird nur ein lokales Vorschaubild angezeigt – es geht keine
 * Anfrage an YouTube oder Twitch, und es werden keine Cookies Dritter gesetzt.
 */

type LazyEmbedProps = {
  provider: 'youtube' | 'twitch';
  embedUrl: string;
  title: string;
  externalUrl: string;
  /** Vorschaubild aus der Medienbibliothek (optional). */
  poster?: React.ReactNode;
};

const PROVIDER_LABEL: Record<LazyEmbedProps['provider'], string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
};

export function LazyEmbed({ provider, embedUrl, title, externalUrl, poster }: LazyEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const providerName = PROVIDER_LABEL[provider];

  if (loaded) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-black">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
      {poster ? <div className="absolute inset-0 opacity-45">{poster}</div> : null}

      <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="max-w-md text-sm text-[var(--color-ink-muted)]">
          Dieses Video wird von {providerName} bereitgestellt. Beim Abspielen werden Daten an{' '}
          {providerName} übertragen.
        </p>
        <button type="button" onClick={() => setLoaded(true)} className="btn-primary">
          <Icons.play size={18} />
          Video laden und abspielen
        </button>
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-ink-subtle)] underline underline-offset-2 hover:text-[var(--color-ink-muted)]"
        >
          Stattdessen direkt auf {providerName} ansehen
        </a>
      </div>
    </div>
  );
}
