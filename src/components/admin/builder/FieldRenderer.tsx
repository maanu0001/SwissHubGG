'use client';

import { useId } from 'react';
import { Icons } from '@/components/ui/Icon';
import { MediaPicker, type MediaOption } from '@/components/admin/builder/MediaPicker';
import type { FieldDescriptor } from '@/lib/content/sectionFields';

/**
 * Rendert ein einzelnes Eingabefeld anhand seiner Beschreibung.
 * Damit sehen alle Abschnittseditoren gleich aus und verhalten sich gleich.
 */

type Value = Record<string, unknown>;

type FieldRendererProps = {
  field: FieldDescriptor;
  value: Value;
  onChange: (key: string, next: unknown) => void;
  media: MediaOption[];
  sponsors: { id: string; name: string }[];
  errors?: Record<string, string>;
  pathPrefix?: string;
};

type LinkValue = { label: string; href: string; style: string; external: boolean };

const EMPTY_LINK: LinkValue = { label: '', href: '', style: 'primary', external: false };

export function FieldRenderer({ field, value, onChange, media, sponsors, errors, pathPrefix = '' }: FieldRendererProps) {
  const generatedId = useId();
  const path = pathPrefix ? `${pathPrefix}.${'key' in field ? field.key : ''}` : ('key' in field ? field.key : '');
  const error = errors?.[path];
  const inputId = `${generatedId}-${path || 'field'}`;

  const describedBy = error ? `${inputId}-error` : 'hint' in field && field.hint ? `${inputId}-hint` : undefined;

  const wrap = (control: React.ReactNode, label: string, hint?: string) => (
    <div>
      <label htmlFor={inputId} className="field-label">
        {label}
      </label>
      {control}
      {error ? (
        <p id={`${inputId}-error`} className="field-error">
          <Icons.alert size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );

  switch (field.kind) {
    case 'text':
      return wrap(
        <input
          id={inputId}
          type="text"
          value={String(value[field.key] ?? '')}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
          className={`input ${error ? 'input-invalid' : ''}`}
        />,
        field.label,
        field.hint,
      );

    case 'textarea':
    case 'markdown':
      return wrap(
        <textarea
          id={inputId}
          rows={field.rows ?? 5}
          value={String(value[field.key] ?? '')}
          maxLength={'maxLength' in field ? field.maxLength : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(field.key, event.target.value)}
          className={`input resize-y font-normal ${field.kind === 'markdown' ? 'font-mono text-[13px]' : ''} ${error ? 'input-invalid' : ''}`}
        />,
        field.label,
        field.hint,
      );

    case 'number':
      return wrap(
        <input
          id={inputId}
          type="number"
          min={field.min}
          max={field.max}
          value={Number(value[field.key] ?? field.min ?? 0)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(field.key, Number(event.target.value))}
          className={`input ${error ? 'input-invalid' : ''}`}
        />,
        field.label,
        field.hint,
      );

    case 'boolean':
      return (
        <div className="flex items-start gap-3">
          <input
            id={inputId}
            type="checkbox"
            checked={Boolean(value[field.key])}
            onChange={(event) => onChange(field.key, event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-line-strong)] bg-[var(--color-canvas)] accent-[var(--color-brand)]"
          />
          <div>
            <label htmlFor={inputId} className="text-sm text-[var(--color-ink)]">
              {field.label}
            </label>
            {field.hint ? <p className="field-hint">{field.hint}</p> : null}
          </div>
        </div>
      );

    case 'select':
      return wrap(
        <select
          id={inputId}
          value={String(value[field.key] ?? field.options[0]?.value ?? '')}
          aria-describedby={describedBy}
          onChange={(event) => {
            const raw = event.target.value;
            // Spaltenzahlen sind im Schema Zahlen, nicht Zeichenketten.
            const next = /^\d+$/.test(raw) && field.key === 'columns' ? Number(raw) : raw;
            onChange(field.key, next);
          }}
          className="select"
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>,
        field.label,
        field.hint,
      );

    case 'multiselect': {
      const current = Array.isArray(value[field.key]) ? (value[field.key] as string[]) : [];
      return (
        <fieldset>
          <legend className="field-label">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => {
              const checked = current.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                    checked
                      ? 'border-[var(--color-brand-text)] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                      : 'border-[var(--color-line)] text-[var(--color-ink-muted)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(
                        field.key,
                        checked ? current.filter((entry) => entry !== option.value) : [...current, option.value],
                      )
                    }
                    className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {field.hint ? <p className="field-hint">{field.hint}</p> : null}
        </fieldset>
      );
    }

    case 'sponsorPicker': {
      const current = Array.isArray(value[field.key]) ? (value[field.key] as string[]) : [];
      return (
        <fieldset>
          <legend className="field-label">{field.label}</legend>
          {sponsors.length === 0 ? (
            <p className="field-hint">Es sind noch keine Sponsoren erfasst.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sponsors.map((sponsor) => {
                const checked = current.includes(sponsor.id);
                return (
                  <label
                    key={sponsor.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                      checked
                        ? 'border-[var(--color-brand-text)] bg-[var(--color-brand-soft)] text-[var(--color-brand-text)]'
                        : 'border-[var(--color-line)] text-[var(--color-ink-muted)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange(
                          field.key,
                          checked ? current.filter((entry) => entry !== sponsor.id) : [...current, sponsor.id],
                        )
                      }
                      className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                    />
                    {sponsor.name}
                  </label>
                );
              })}
            </div>
          )}
          {field.hint ? <p className="field-hint">{field.hint}</p> : null}
        </fieldset>
      );
    }

    case 'media':
      return (
        <MediaPicker
          media={media}
          label={field.label}
          hint={field.hint}
          required={field.required}
          value={(value[field.key] as string | null) ?? null}
          onChange={(next) => onChange(field.key, next)}
        />
      );

    case 'link': {
      const link = (value[field.key] as LinkValue | null) ?? null;
      const active = link !== null;

      return (
        <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">{field.label}</legend>

          <label className="mb-3 flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => onChange(field.key, event.target.checked ? { ...EMPTY_LINK } : null)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Button anzeigen
          </label>

          {active ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${inputId}-label`} className="field-label">
                  Beschriftung
                </label>
                <input
                  id={`${inputId}-label`}
                  type="text"
                  maxLength={60}
                  value={link.label}
                  onChange={(event) => onChange(field.key, { ...link, label: event.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`${inputId}-href`} className="field-label">
                  Ziel
                </label>
                <input
                  id={`${inputId}-href`}
                  type="text"
                  maxLength={300}
                  placeholder="/turniere oder https://discord.gg/…"
                  value={link.href}
                  onChange={(event) => onChange(field.key, { ...link, href: event.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`${inputId}-style`} className="field-label">
                  Darstellung
                </label>
                <select
                  id={`${inputId}-style`}
                  value={link.style}
                  onChange={(event) => onChange(field.key, { ...link, style: event.target.value })}
                  className="select"
                >
                  <option value="primary">Hauptaktion</option>
                  <option value="secondary">Sekundär</option>
                  <option value="ghost">Dezent</option>
                </select>
              </div>
              <label className="flex items-end gap-2 pb-2.5 text-sm text-[var(--color-ink-muted)]">
                <input
                  type="checkbox"
                  checked={link.external}
                  onChange={(event) => onChange(field.key, { ...link, external: event.target.checked })}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                In neuem Tab öffnen
              </label>
            </div>
          ) : null}

          {error ? (
            <p className="field-error">
              <Icons.alert size={13} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
        </fieldset>
      );
    }

    case 'linkList': {
      const links = Array.isArray(value[field.key]) ? (value[field.key] as LinkValue[]) : [];

      return (
        <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">{field.label}</legend>

          <ul className="space-y-3">
            {links.map((link, index) => (
              <li key={index} className="grid gap-2 rounded-lg bg-[var(--color-canvas)] p-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  type="text"
                  aria-label={`Beschriftung ${index + 1}`}
                  placeholder="Beschriftung"
                  value={link.label}
                  onChange={(event) => {
                    const next = [...links];
                    next[index] = { ...link, label: event.target.value };
                    onChange(field.key, next);
                  }}
                  className="input"
                />
                <input
                  type="text"
                  aria-label={`Ziel ${index + 1}`}
                  placeholder="/turniere"
                  value={link.href}
                  onChange={(event) => {
                    const next = [...links];
                    next[index] = { ...link, href: event.target.value };
                    onChange(field.key, next);
                  }}
                  className="input"
                />
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => onChange(field.key, links.filter((_, position) => position !== index))}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>

          {links.length < (field.max ?? 6) ? (
            <button
              type="button"
              className="btn-secondary btn-sm mt-3"
              onClick={() => onChange(field.key, [...links, { ...EMPTY_LINK, style: 'secondary' }])}
            >
              Link hinzufügen
            </button>
          ) : null}

          {field.hint ? <p className="field-hint">{field.hint}</p> : null}
        </fieldset>
      );
    }

    case 'mediaList': {
      const items = Array.isArray(value[field.key])
        ? (value[field.key] as { mediaId: string; caption: string }[])
        : [];

      return (
        <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">{field.label}</legend>

          <ul className="space-y-4">
            {items.map((item, index) => (
              <li key={index} className="rounded-lg bg-[var(--color-canvas)] p-3">
                <MediaPicker
                  media={media}
                  label={`Bild ${index + 1}`}
                  value={item.mediaId || null}
                  onChange={(next) => {
                    const list = [...items];
                    list[index] = { ...item, mediaId: next ?? '' };
                    onChange(field.key, list);
                  }}
                />
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    aria-label={`Bildunterschrift ${index + 1}`}
                    placeholder="Bildunterschrift (optional)"
                    value={item.caption ?? ''}
                    maxLength={200}
                    onChange={(event) => {
                      const list = [...items];
                      list[index] = { ...item, caption: event.target.value };
                      onChange(field.key, list);
                    }}
                    className="input"
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-sm shrink-0"
                    onClick={() => onChange(field.key, items.filter((_, position) => position !== index))}
                  >
                    Entfernen
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {items.length < (field.max ?? 24) ? (
            <button
              type="button"
              className="btn-secondary btn-sm mt-3"
              onClick={() => onChange(field.key, [...items, { mediaId: '', caption: '' }])}
            >
              Bild hinzufügen
            </button>
          ) : null}
        </fieldset>
      );
    }

    case 'objectList': {
      const items = Array.isArray(value[field.key]) ? (value[field.key] as Value[]) : [];

      return (
        <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">{field.label}</legend>
          {field.hint ? <p className="mb-3 text-xs text-[var(--color-ink-subtle)]">{field.hint}</p> : null}

          <ul className="space-y-4">
            {items.map((item, index) => (
              <li key={index} className="rounded-lg bg-[var(--color-canvas)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {field.itemLabel} {index + 1}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={index === 0}
                      onClick={() => {
                        const list = [...items];
                        const previous = list[index - 1];
                        const current = list[index];
                        if (!previous || !current) return;
                        list[index - 1] = current;
                        list[index] = previous;
                        onChange(field.key, list);
                      }}
                    >
                      ↑<span className="sr-only">nach oben</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={index === items.length - 1}
                      onClick={() => {
                        const list = [...items];
                        const next = list[index + 1];
                        const current = list[index];
                        if (!next || !current) return;
                        list[index + 1] = current;
                        list[index] = next;
                        onChange(field.key, list);
                      }}
                    >
                      ↓<span className="sr-only">nach unten</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => onChange(field.key, items.filter((_, position) => position !== index))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {field.fields.map((subField) => (
                    <FieldRenderer
                      key={subField.key}
                      field={subField}
                      value={item}
                      media={media}
                      sponsors={sponsors}
                      errors={errors}
                      pathPrefix={`${path}.${index}`}
                      onChange={(subKey, next) => {
                        const list = [...items];
                        list[index] = { ...item, [subKey]: next };
                        onChange(field.key, list);
                      }}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {items.length < (field.max ?? 12) ? (
            <button
              type="button"
              className="btn-secondary btn-sm mt-3"
              onClick={() => onChange(field.key, [...items, { ...field.template }])}
            >
              {field.addLabel}
            </button>
          ) : null}
        </fieldset>
      );
    }

    case 'group': {
      const nested = (value[field.key] as Value | undefined) ?? {};

      return (
        <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
          <legend className="px-1 text-sm font-medium text-[var(--color-ink)]">{field.label}</legend>
          <div className="space-y-4">
            {field.fields.map((subField) => (
              <FieldRenderer
                key={subField.key}
                field={subField}
                value={nested}
                media={media}
                sponsors={sponsors}
                errors={errors}
                pathPrefix={path}
                onChange={(subKey, next) => onChange(field.key, { ...nested, [subKey]: next })}
              />
            ))}
          </div>
        </fieldset>
      );
    }

    default:
      return null;
  }
}
