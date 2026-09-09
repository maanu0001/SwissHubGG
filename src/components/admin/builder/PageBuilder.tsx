'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { SectionType } from '@prisma/client';
import { Icons } from '@/components/ui/Icon';
import { FieldRenderer } from '@/components/admin/builder/FieldRenderer';
import type { MediaOption } from '@/components/admin/builder/MediaPicker';
import { SECTION_FIELDS } from '@/lib/content/sectionFields';
import { SECTION_META, defaultSectionData } from '@/lib/content/sections';
import {
  addSectionAction,
  deleteSectionAction,
  reorderSectionsAction,
  updateSectionAction,
} from '@/server/actions/pages';
import { idleState } from '@/server/actions/types';

/**
 * Website-Builder.
 *
 * Redaktionen stellen Seiten aus vorgegebenen Blöcken zusammen. Die
 * Gestaltung bleibt dabei immer im SwissHub-Designsystem – es gibt bewusst
 * keine freien Stil- oder HTML-Eingaben.
 *
 * Änderungen werden automatisch gespeichert (mit sichtbarem Status) und landen
 * zunächst im Entwurf. Erst „Veröffentlichen“ macht sie öffentlich sichtbar.
 */

export type BuilderSection = {
  id: string;
  type: SectionType;
  visible: boolean;
  data: Record<string, unknown>;
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

type PageBuilderProps = {
  pageId: string;
  initialSections: BuilderSection[];
  media: MediaOption[];
  sponsors: { id: string; name: string }[];
  canEdit: boolean;
};

const AUTOSAVE_DELAY_MS = 1200;

export function PageBuilder({ pageId, initialSections, media, sponsors, canEdit }: PageBuilderProps) {
  const [sections, setSections] = useState<BuilderSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [statusMessage, setStatusMessage] = useState('Alle Änderungen gespeichert');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingRef = useRef(new Set<string>());

  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? null,
    [sections, selectedId],
  );

  // Warnung, wenn ungespeicherte Änderungen bestehen.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pendingRef.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const persist = useCallback(async (section: BuilderSection) => {
    setSaveState('saving');
    setStatusMessage('Änderungen werden gespeichert …');

    const formData = new FormData();
    formData.set('sectionId', section.id);
    formData.set('data', JSON.stringify(section.data));
    if (section.visible) formData.set('visible', 'on');

    const result = await updateSectionAction(idleState, formData);
    pendingRef.current.delete(section.id);

    if (result.status === 'error') {
      setSaveState('error');
      setStatusMessage(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    setFieldErrors({});
    if (pendingRef.current.size === 0) {
      setSaveState('saved');
      setStatusMessage('Alle Änderungen gespeichert');
    }
  }, []);

  const scheduleSave = useCallback(
    (section: BuilderSection) => {
      pendingRef.current.add(section.id);
      setSaveState('dirty');
      setStatusMessage('Nicht gespeicherte Änderungen …');

      const existing = timers.current.get(section.id);
      if (existing) clearTimeout(existing);

      timers.current.set(
        section.id,
        setTimeout(() => {
          timers.current.delete(section.id);
          void persist(section);
        }, AUTOSAVE_DELAY_MS),
      );
    },
    [persist],
  );

  const updateSection = useCallback(
    (id: string, mutate: (section: BuilderSection) => BuilderSection) => {
      setSections((current) => {
        const next = current.map((section) => (section.id === id ? mutate(section) : section));
        const changed = next.find((section) => section.id === id);
        if (changed) scheduleSave(changed);
        return next;
      });
    },
    [scheduleSave],
  );

  const saveNow = useCallback(async () => {
    for (const [id, timer] of timers.current) {
      clearTimeout(timer);
      timers.current.delete(id);
      const section = sections.find((entry) => entry.id === id);
      if (section) await persist(section);
    }
  }, [persist, sections]);

  const handleAdd = (type: SectionType) => {
    setAddOpen(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('pageId', pageId);
      formData.set('type', type);

      const result = await addSectionAction(idleState, formData);
      if (result.status !== 'success' || !result.data?.id) {
        setSaveState('error');
        setStatusMessage(result.message);
        return;
      }

      const section: BuilderSection = {
        id: result.data.id,
        type,
        visible: true,
        data: defaultSectionData(type) as Record<string, unknown>,
      };
      setSections((current) => [...current, section]);
      setSelectedId(section.id);
      setStatusMessage(`Abschnitt „${SECTION_META[type].label}“ hinzugefügt`);
    });
  };

  const handleDelete = (id: string) => {
    const section = sections.find((entry) => entry.id === id);
    if (!section) return;
    if (!window.confirm(`Abschnitt „${SECTION_META[section.type].label}“ wirklich entfernen?`)) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set('sectionId', id);
      const result = await deleteSectionAction(idleState, formData);

      if (result.status !== 'success') {
        setSaveState('error');
        setStatusMessage(result.message);
        return;
      }

      setSections((current) => current.filter((entry) => entry.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      setStatusMessage('Abschnitt entfernt');
    });
  };

  const persistOrder = useCallback(
    (ordered: BuilderSection[]) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.set('pageId', pageId);
        formData.set('order', ordered.map((section) => section.id).join(','));

        const result = await reorderSectionsAction(idleState, formData);
        setStatusMessage(result.status === 'success' ? 'Reihenfolge gespeichert' : result.message);
        if (result.status !== 'success') setSaveState('error');
      });
    },
    [pageId],
  );

  const move = (id: string, direction: -1 | 1) => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;

      const next = [...current];
      const moved = next[index];
      const swapped = next[target];
      if (!moved || !swapped) return current;
      next[index] = swapped;
      next[target] = moved;

      persistOrder(next);
      return next;
    });
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;

    setSections((current) => {
      const from = current.findIndex((section) => section.id === dragId);
      const to = current.findIndex((section) => section.id === targetId);
      if (from < 0 || to < 0) return current;

      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);

      persistOrder(next);
      return next;
    });
    setDragId(null);
  };

  const statusTone =
    saveState === 'error'
      ? 'text-[var(--color-danger-text)]'
      : saveState === 'saved'
        ? 'text-[var(--color-success-text)]'
        : 'text-[var(--color-warning-text)]';

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
      <div className="lg:sticky lg:top-6">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-ink)]">Abschnitte</h2>
            <span className="text-xs text-[var(--color-ink-subtle)]">{sections.length}</span>
          </div>

          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-ink-subtle)]">
              Noch keine Abschnitte. Füge unten den ersten hinzu.
            </p>
          ) : (
            <ul className="space-y-1">
              {sections.map((section, index) => {
                const meta = SECTION_META[section.type];
                const active = section.id === selectedId;

                return (
                  <li
                    key={section.id}
                    draggable={canEdit}
                    onDragStart={() => setDragId(section.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(section.id)}
                    className={`rounded-lg border transition-colors ${
                      active
                        ? 'border-[var(--color-brand-text)] bg-[var(--color-brand-soft)]'
                        : 'border-transparent hover:bg-[var(--color-surface-raised)]'
                    } ${dragId === section.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-1 p-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedId(section.id)}
                        className="min-w-0 flex-1 text-left"
                        aria-current={active ? 'true' : undefined}
                      >
                        <span className={`block truncate text-sm ${active ? 'font-semibold text-[var(--color-brand-text)]' : 'text-[var(--color-ink)]'}`}>
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-ink-subtle)]">
                          {sectionSummary(section)}
                          {!section.visible ? ' · ausgeblendet' : ''}
                        </span>
                      </button>

                      {canEdit ? (
                        <span className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            className="px-1 text-xs text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)] disabled:opacity-30"
                            disabled={index === 0}
                            onClick={() => move(section.id, -1)}
                          >
                            ↑<span className="sr-only">{meta.label} nach oben verschieben</span>
                          </button>
                          <button
                            type="button"
                            className="px-1 text-xs text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)] disabled:opacity-30"
                            disabled={index === sections.length - 1}
                            onClick={() => move(section.id, 1)}
                          >
                            ↓<span className="sr-only">{meta.label} nach unten verschieben</span>
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit ? (
            <div className="relative mt-4">
              <button type="button" className="btn-secondary btn-sm w-full" onClick={() => setAddOpen((value) => !value)}>
                Abschnitt hinzufügen
              </button>

              {addOpen ? (
                <div className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-80 overflow-y-auto rounded-lg border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] p-2 shadow-[var(--shadow-raised)]">
                  {(['Struktur', 'Inhalt', 'Medien', 'Dynamisch'] as const).map((group) => {
                    const entries = Object.entries(SECTION_META).filter(([, meta]) => meta.group === group);
                    return (
                      <div key={group} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-subtle)]">
                          {group}
                        </p>
                        {entries.map(([type, meta]) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleAdd(type as SectionType)}
                            className="block w-full rounded px-2 py-1.5 text-left text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-ink)]"
                          >
                            {meta.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <p aria-live="polite" className={`mt-3 flex items-center gap-1.5 px-1 text-xs ${statusTone}`}>
          {saveState === 'saved' ? <Icons.check size={13} /> : saveState === 'error' ? <Icons.alert size={13} /> : null}
          {statusMessage}
        </p>
      </div>

      <div>
        {selected ? (
          <div className="card p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-line)] pb-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-ink)]">
                  {SECTION_META[selected.type].label}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{SECTION_META[selected.type].description}</p>
              </div>

              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-muted)]">
                    <input
                      type="checkbox"
                      checked={selected.visible}
                      onChange={(event) =>
                        updateSection(selected.id, (section) => ({ ...section, visible: event.target.checked }))
                      }
                      className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                    />
                    Sichtbar
                  </label>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => void saveNow()}>
                    Jetzt speichern
                  </button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>
                    Entfernen
                  </button>
                </div>
              ) : null}
            </div>

            <fieldset disabled={!canEdit} className="space-y-5">
              {SECTION_FIELDS[selected.type].map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={selected.data}
                  media={media}
                  sponsors={sponsors}
                  errors={fieldErrors}
                  onChange={(key, next) =>
                    updateSection(selected.id, (section) => ({
                      ...section,
                      data: { ...section.data, [key]: next },
                    }))
                  }
                />
              ))}
            </fieldset>
          </div>
        ) : (
          <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
            <Icons.info size={22} className="mb-3 text-[var(--color-ink-subtle)]" />
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Kein Abschnitt ausgewählt</h2>
            <p className="mt-2 max-w-sm text-sm text-[var(--color-ink-muted)]">
              Wähle links einen Abschnitt aus oder füge einen neuen hinzu, um mit der Bearbeitung zu beginnen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Kurzbeschreibung eines Abschnitts für die Übersichtsliste. */
function sectionSummary(section: BuilderSection): string {
  const data = section.data;
  const candidates = ['headline', 'title', 'eyebrow', 'question', 'url'];

  for (const key of candidates) {
    const value = data[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.length > 34 ? `${value.slice(0, 33)}…` : value;
    }
  }

  return 'Ohne Titel';
}
