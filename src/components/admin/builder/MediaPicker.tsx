'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Icons } from '@/components/ui/Icon';

/** Auswahl eines Mediums aus der Bibliothek – ohne Seitenwechsel. */

export type MediaOption = {
  id: string;
  storageKey: string;
  originalName: string;
  alt: string | null;
  title: string | null;
  kind: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  width: number | null;
  height: number | null;
};

type MediaPickerProps = {
  media: MediaOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  hint?: string;
  required?: boolean;
};

export function MediaPicker({ media, value, onChange, label, hint, required }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => media.find((item) => item.id === value) ?? null, [media, value]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return media.slice(0, 60);
    return media
      .filter((item) =>
        [item.originalName, item.title ?? '', item.alt ?? ''].some((field) => field.toLowerCase().includes(needle)),
      )
      .slice(0, 60);
  }, [media, query]);

  return (
    <div>
      <p className="field-label">
        {label}
        {required ? <span className="text-[var(--color-brand-text)]"> *</span> : null}
      </p>

      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-[var(--color-line)] bg-[var(--color-surface-raised)]">
          {selected && selected.kind === 'IMAGE' ? (
            <Image
              src={`/api/media/${selected.storageKey}`}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[var(--color-ink-subtle)]">
              <Icons.info size={16} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[var(--color-ink)]">
            {selected ? (selected.title ?? selected.originalName) : 'Kein Medium ausgewählt'}
          </p>
          {selected ? (
            <p className="truncate text-xs text-[var(--color-ink-subtle)]">
              {selected.alt ? `Alt: ${selected.alt}` : 'Ohne Alt-Text – bitte in der Medienbibliothek ergänzen.'}
            </p>
          ) : hint ? (
            <p className="text-xs text-[var(--color-ink-subtle)]">{hint}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
            {selected ? 'Ändern' : 'Auswählen'}
          </button>
          {selected ? (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>
              Entfernen
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Medium auswählen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-[var(--radius-card)] border border-[var(--color-line-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] p-4">
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Medium auswählen</h2>
              <button type="button" className="btn-ghost p-2" onClick={() => setOpen(false)}>
                <Icons.close size={18} />
                <span className="sr-only">Schliessen</span>
              </button>
            </div>

            <div className="border-b border-[var(--color-line)] p-4">
              <label htmlFor="media-search" className="sr-only">
                Medien durchsuchen
              </label>
              <input
                id="media-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nach Dateiname, Titel oder Alt-Text suchen"
                className="input"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--color-ink-subtle)]">
                  {media.length === 0
                    ? 'Die Medienbibliothek ist noch leer. Lade zuerst Dateien unter „Medien“ hoch.'
                    : 'Keine Treffer für deine Suche.'}
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(item.id);
                          setOpen(false);
                        }}
                        className={`w-full overflow-hidden rounded-lg border text-left transition-colors ${
                          item.id === value
                            ? 'border-[var(--color-brand-text)]'
                            : 'border-[var(--color-line)] hover:border-[var(--color-line-strong)]'
                        }`}
                      >
                        <span className="relative block aspect-square bg-[var(--color-surface-raised)]">
                          {item.kind === 'IMAGE' ? (
                            <Image
                              src={`/api/media/${item.storageKey}`}
                              alt=""
                              fill
                              sizes="160px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-[var(--color-ink-subtle)]">
                              Dokument
                            </span>
                          )}
                        </span>
                        <span className="block truncate p-2 text-xs text-[var(--color-ink-muted)]">
                          {item.title ?? item.originalName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
