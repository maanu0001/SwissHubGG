/**
 * Wird von Next.js einmal pro Serverprozess beim Start ausgeführt.
 * Hier startet der kontrollierte Hintergrundlauf (terminierte
 * Veröffentlichungen, E-Mail-Warteschlange, Aufbewahrungsfristen).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { startScheduler } = await import('@/lib/scheduler');
  startScheduler();
}
