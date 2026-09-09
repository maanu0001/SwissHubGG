'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { submitContactRequest } from '@/server/actions/contact';
import { HONEYPOT_FIELD, initialContactState } from '@/lib/validation/contact';
import { Icons } from '@/components/ui/Icon';

/**
 * Kontaktformular.
 *
 * Die verbindliche Prüfung erfolgt serverseitig. Im Browser sorgen native
 * Attribute (`required`, `type`, `maxLength`) für schnelle Rückmeldung, ohne
 * dass eine Validierungsbibliothek geladen werden muss.
 */

type Category = { key: string; label: string; description: string | null };

type ContactFormProps = {
  categories: Category[];
  defaultCategory?: string;
  attachmentsEnabled: boolean;
  maxUploadMb: number;
  captchaSiteKey: string | null;
};

export function ContactForm({
  categories,
  defaultCategory,
  attachmentsEnabled,
  maxUploadMb,
  captchaSiteKey,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(submitContactRequest, initialContactState);
  const [messageLength, setMessageLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const fieldId = (name: string) => `${baseId}-${name}`;
  const errorId = (name: string) => `${baseId}-${name}-error`;

  useEffect(() => {
    if (state.status === 'idle') return;
    feedbackRef.current?.focus();
    if (state.status === 'success') {
      formRef.current?.reset();
      setMessageLength(0);
    }
  }, [state]);

  if (state.status === 'success') {
    return (
      <div
        ref={feedbackRef}
        tabIndex={-1}
        role="status"
        className="card border-[color-mix(in_srgb,var(--color-success)_50%,transparent)] p-8 text-center"
      >
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-[var(--color-success-text)]">
          <Icons.check size={24} />
        </span>
        <h2 className="text-lg font-bold text-[var(--color-ink)]">Nachricht gesendet</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">{state.message}</p>
        {state.reference ? (
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">
            Deine Referenz:{' '}
            <span className="font-mono font-semibold text-[var(--color-ink)]">{state.reference}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {captchaSiteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      ) : null}

      <form ref={formRef} action={formAction} noValidate={false} className="space-y-5">
        {state.status === 'error' ? (
          <div
            ref={feedbackRef}
            tabIndex={-1}
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] p-4 text-sm text-[var(--color-danger-text)]"
          >
            <Icons.alert size={18} className="mt-0.5 shrink-0" />
            <p>{state.message}</p>
          </div>
        ) : null}

        {/* Honeypot: für Menschen unsichtbar und aus dem Fokus genommen. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={fieldId(HONEYPOT_FIELD)}>Bitte dieses Feld leer lassen</label>
          <input id={fieldId(HONEYPOT_FIELD)} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={fieldId('name')} className="field-label">
              Name <span className="text-[var(--color-brand-text)]">*</span>
            </label>
            <input
              id={fieldId('name')}
              name="name"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              aria-describedby={state.fieldErrors?.name ? errorId('name') : undefined}
              aria-invalid={state.fieldErrors?.name ? true : undefined}
              className={`input ${state.fieldErrors?.name ? 'input-invalid' : ''}`}
            />
            {state.fieldErrors?.name ? (
              <p id={errorId('name')} className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={fieldId('email')} className="field-label">
              E-Mail-Adresse <span className="text-[var(--color-brand-text)]">*</span>
            </label>
            <input
              id={fieldId('email')}
              name="email"
              type="email"
              required
              maxLength={160}
              autoComplete="email"
              aria-describedby={state.fieldErrors?.email ? errorId('email') : undefined}
              aria-invalid={state.fieldErrors?.email ? true : undefined}
              className={`input ${state.fieldErrors?.email ? 'input-invalid' : ''}`}
            />
            {state.fieldErrors?.email ? (
              <p id={errorId('email')} className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={fieldId('organisation')} className="field-label">
              Organisation <span className="font-normal text-[var(--color-ink-subtle)]">(optional)</span>
            </label>
            <input
              id={fieldId('organisation')}
              name="organisation"
              type="text"
              maxLength={120}
              autoComplete="organization"
              className="input"
            />
          </div>

          <div>
            <label htmlFor={fieldId('category')} className="field-label">
              Kategorie <span className="text-[var(--color-brand-text)]">*</span>
            </label>
            <select
              id={fieldId('category')}
              name="category"
              required
              defaultValue={defaultCategory ?? ''}
              aria-describedby={state.fieldErrors?.category ? errorId('category') : `${baseId}-category-hint`}
              aria-invalid={state.fieldErrors?.category ? true : undefined}
              className={`select ${state.fieldErrors?.category ? 'input-invalid' : ''}`}
            >
              <option value="" disabled>
                Bitte auswählen
              </option>
              {categories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
            {state.fieldErrors?.category ? (
              <p id={errorId('category')} className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.category}
              </p>
            ) : (
              <p id={`${baseId}-category-hint`} className="field-hint">
                So landet deine Anfrage direkt beim richtigen Team.
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor={fieldId('subject')} className="field-label">
            Betreff <span className="text-[var(--color-brand-text)]">*</span>
          </label>
          <input
            id={fieldId('subject')}
            name="subject"
            type="text"
            required
            minLength={3}
            maxLength={150}
            aria-describedby={state.fieldErrors?.subject ? errorId('subject') : undefined}
            aria-invalid={state.fieldErrors?.subject ? true : undefined}
            className={`input ${state.fieldErrors?.subject ? 'input-invalid' : ''}`}
          />
          {state.fieldErrors?.subject ? (
            <p id={errorId('subject')} className="field-error">
              <Icons.alert size={13} className="mt-0.5 shrink-0" />
              {state.fieldErrors.subject}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={fieldId('message')} className="field-label">
            Nachricht <span className="text-[var(--color-brand-text)]">*</span>
          </label>
          <textarea
            id={fieldId('message')}
            name="message"
            required
            rows={7}
            minLength={20}
            maxLength={5000}
            onChange={(event) => setMessageLength(event.target.value.length)}
            aria-describedby={state.fieldErrors?.message ? errorId('message') : `${baseId}-message-hint`}
            aria-invalid={state.fieldErrors?.message ? true : undefined}
            className={`input resize-y ${state.fieldErrors?.message ? 'input-invalid' : ''}`}
          />
          {state.fieldErrors?.message ? (
            <p id={errorId('message')} className="field-error">
              <Icons.alert size={13} className="mt-0.5 shrink-0" />
              {state.fieldErrors.message}
            </p>
          ) : (
            <p id={`${baseId}-message-hint`} className="field-hint">
              {messageLength} / 5000 Zeichen · mindestens 20 Zeichen
            </p>
          )}
        </div>

        {attachmentsEnabled ? (
          <div>
            <label htmlFor={fieldId('attachment')} className="field-label">
              Anhang <span className="font-normal text-[var(--color-ink-subtle)]">(optional)</span>
            </label>
            <input
              id={fieldId('attachment')}
              name="attachment"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
              aria-describedby={state.fieldErrors?.attachment ? errorId('attachment') : `${baseId}-attachment-hint`}
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-surface-raised)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--color-ink)]"
            />
            {state.fieldErrors?.attachment ? (
              <p id={errorId('attachment')} className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.attachment}
              </p>
            ) : (
              <p id={`${baseId}-attachment-hint`} className="field-hint">
                Erlaubt sind JPEG, PNG, WebP, AVIF und PDF bis {maxUploadMb} MB.
              </p>
            )}
          </div>
        ) : null}

        {captchaSiteKey ? (
          <div>
            <div className="cf-turnstile" data-sitekey={captchaSiteKey} data-theme="dark" data-language="de" />
            {state.fieldErrors?.captcha ? (
              <p className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.captcha}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-start gap-3">
          <input
            id={fieldId('privacy')}
            name="privacy"
            type="checkbox"
            required
            aria-describedby={state.fieldErrors?.privacy ? errorId('privacy') : undefined}
            aria-invalid={state.fieldErrors?.privacy ? true : undefined}
            className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--color-line-strong)] bg-[var(--color-base)] accent-[var(--color-brand)]"
          />
          <div>
            <label htmlFor={fieldId('privacy')} className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
              Ich habe die{' '}
              <a href="/datenschutz" className="text-[var(--color-brand-text)] underline underline-offset-2">
                Datenschutzerklärung
              </a>{' '}
              gelesen und bin damit einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden.{' '}
              <span className="text-[var(--color-brand-text)]">*</span>
            </label>
            {state.fieldErrors?.privacy ? (
              <p id={errorId('privacy')} className="field-error">
                <Icons.alert size={13} className="mt-0.5 shrink-0" />
                {state.fieldErrors.privacy}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Wird gesendet …' : 'Nachricht senden'}
          </button>
          <p className="text-xs text-[var(--color-ink-subtle)]">
            Mit <span className="text-[var(--color-brand-text)]">*</span> markierte Felder sind Pflichtfelder.
          </p>
        </div>
      </form>
    </>
  );
}
