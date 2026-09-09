'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Icons } from '@/components/ui/Icon';
import { idleState, type ActionState } from '@/server/actions/types';

/**
 * Feldfehler eines Formulars.
 *
 * Der Zustand einer Server Action wird über einen Kontext bereitgestellt.
 * Dadurch bleiben die Formularfelder selbst Server Components – es muss keine
 * Funktion über die Server-/Client-Grenze gereicht werden, was React nicht
 * zulässt.
 */

const ActionStateContext = createContext<ActionState>(idleState);

export function ActionStateProvider({ state, children }: { state: ActionState; children: ReactNode }) {
  return <ActionStateContext.Provider value={state}>{children}</ActionStateContext.Provider>;
}

export function useActionFormState(): ActionState {
  return useContext(ActionStateContext);
}

/** Fehlermeldung eines einzelnen Feldes, sofern vorhanden. */
export function FieldError({ name, id }: { name: string; id?: string }) {
  const state = useActionFormState();
  const message = state.fieldErrors?.[name];

  if (!message) return null;

  return (
    <p id={id} className="field-error">
      <Icons.alert size={13} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

type FieldProps = {
  label: string;
  /** Name des Eingabefeldes; dient zugleich als `htmlFor` und `id`-Vorschlag. */
  name: string;
  /** Abweichender Schlüssel, falls die `id` eindeutig sein muss (z. B. in Listen). */
  errorKey?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

/**
 * Beschriftetes Formularfeld mit Hinweis- und Fehlertext.
 *
 * Liegt ein Fehler vor, wird der umgebende Bereich mit `data-invalid`
 * ausgezeichnet; die zugehörige Gestaltung des Eingabefeldes übernimmt CSS.
 */
export function Field({ label, name, errorKey, hint, required, children }: FieldProps) {
  const state = useActionFormState();
  const key = errorKey ?? name;
  const message = state.fieldErrors?.[key];

  return (
    <div data-invalid={message ? 'true' : undefined}>
      <label htmlFor={name} className="field-label">
        {label}
        {required ? <span className="text-[var(--color-brand-text)]"> *</span> : null}
      </label>

      {children}

      {message ? (
        <FieldError name={key} id={`${name}-error`} />
      ) : hint ? (
        <p id={`${name}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
