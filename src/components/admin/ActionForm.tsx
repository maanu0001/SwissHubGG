'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Icons } from '@/components/ui/Icon';
import { idleState, type ActionState } from '@/server/actions/types';

/**
 * Formular-Wrapper für Server Actions.
 *
 * Zeigt Erfolgs- und Fehlermeldungen an, verwaltet den Ladezustand und meldet
 * das Ergebnis über eine Live-Region an unterstützende Technologien.
 */

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  /** Formular nach erfolgreicher Ausführung zurücksetzen. */
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
};

export function ActionForm({ action, children, className = '', resetOnSuccess = false, onSuccess }: ActionFormProps) {
  const [state, formAction] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const handledRef = useRef<ActionState | null>(null);

  useEffect(() => {
    if (state.status !== 'success' || handledRef.current === state) return;
    handledRef.current = state;

    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.(state);
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      <FormFeedback state={state} />
      {typeof children === 'function' ? children(state) : children}
    </form>
  );
}

export function FormFeedback({ state }: { state: ActionState }) {
  if (state.status === 'idle') {
    return <div aria-live="polite" className="sr-only" />;
  }

  const isError = state.status === 'error';

  return (
    <div
      aria-live="polite"
      role={isError ? 'alert' : 'status'}
      className={`mb-5 flex items-start gap-2.5 rounded-lg border p-3.5 text-sm ${
        isError
          ? 'border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger-text)]'
          : 'border-[color-mix(in_srgb,var(--color-success)_50%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success-text)]'
      }`}
    >
      {isError ? <Icons.alert size={17} className="mt-0.5 shrink-0" /> : <Icons.check size={17} className="mt-0.5 shrink-0" />}
      <p>{state.message}</p>
    </div>
  );
}

/** Absende-Schaltfläche, die den Ladezustand des umgebenden Formulars kennt. */
export function SubmitButton({
  children,
  pendingLabel = 'Wird gespeichert …',
  variant = 'primary',
  className = '',
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  /** Rückfrage vor dem Absenden – für nicht umkehrbare Aktionen. */
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-danger'
        : variant === 'ghost'
          ? 'btn-ghost'
          : 'btn-secondary';

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`${variantClass} ${className}`}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
