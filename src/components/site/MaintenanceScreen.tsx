import { LogoMark } from '@/components/brand/Logo';

/** Wartungsseite für Besucherinnen und Besucher während geplanter Arbeiten. */
export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <LogoMark size={72} priority />
      <h1 className="heading-lg mt-8">Kurz nicht erreichbar</h1>
      <p className="lead mt-4 max-w-lg">{message}</p>
      <p className="muted mt-8">
        Fragen? Schreib uns an{' '}
        <a className="text-[var(--color-brand-text)] underline underline-offset-2" href="mailto:info@swisshub.gg">
          info@swisshub.gg
        </a>
        .
      </p>
    </main>
  );
}
