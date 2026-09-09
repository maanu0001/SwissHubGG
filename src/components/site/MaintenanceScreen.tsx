import { LogoStage } from '@/components/brand/Logo';
import { TechBackdrop } from '@/components/visual/TechBackdrop';
import { getSettings } from '@/lib/settings';

/** Wartungsseite für Besucherinnen und Besucher während geplanter Arbeiten. */
export async function MaintenanceScreen({ message }: { message: string }) {
  const settings = await getSettings();

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <TechBackdrop variant="hero" />

      <div className="relative">
        <LogoStage size="compact" priority />
      </div>

      <p className="meta-brand relative mt-8">Wartung</p>
      <h1 className="heading-lg relative mt-3">Kurz nicht erreichbar</h1>
      <p className="lead relative mx-auto mt-4 max-w-lg">{message}</p>

      {settings.contactEmail ? (
        <p className="muted relative mt-9">
          Fragen? Schreib uns an{' '}
          <a
            className="font-semibold text-[var(--color-brand-text)] underline underline-offset-2"
            href={`mailto:${settings.contactEmail}`}
          >
            {settings.contactEmail}
          </a>
          .
        </p>
      ) : null}
    </main>
  );
}
