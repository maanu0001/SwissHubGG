import type { ReactNode } from 'react';

/**
 * Rahmen für die Geräte-Vorschau.
 *
 * Die Breite wird begrenzt und ein Container-Query-Kontext gesetzt, damit sich
 * responsive Abschnitte wie auf dem jeweiligen Gerät verhalten.
 */
const WIDTHS = {
  desktop: 'w-full',
  tablet: 'w-full max-w-[834px]',
  mobil: 'w-full max-w-[390px]',
} as const;

export function PreviewFrame({
  viewport,
  children,
}: {
  viewport: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  if (viewport === 'desktop') {
    return <div className="min-h-dvh">{children}</div>;
  }

  return (
    <div className="flex justify-center bg-[var(--color-surface)] p-4 sm:p-8">
      <div
        className={`${WIDTHS[viewport]} overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line-strong)] shadow-[var(--shadow-raised)]`}
      >
        {children}
      </div>
    </div>
  );
}
