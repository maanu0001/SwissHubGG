import 'server-only';
import { prisma } from '@/lib/db';

export { requireUser, requirePermission } from '@/lib/auth/guards';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const recentlyTouched = new Map<string, number>();

/**
 * Aktualisiert `lastSeenAt` einer Sitzung höchstens alle fünf Minuten.
 * So bleibt die Sitzungsübersicht aussagekräftig, ohne bei jedem Seitenaufruf
 * zu schreiben.
 */
export async function touchSessionIfNeeded(sessionId: string): Promise<void> {
  const last = recentlyTouched.get(sessionId) ?? 0;
  if (Date.now() - last < TOUCH_INTERVAL_MS) return;

  recentlyTouched.set(sessionId, Date.now());

  // Der Cache darf nicht unbegrenzt wachsen.
  if (recentlyTouched.size > 500) {
    const threshold = Date.now() - TOUCH_INTERVAL_MS;
    for (const [key, value] of recentlyTouched) {
      if (value < threshold) recentlyTouched.delete(key);
    }
  }

  try {
    await prisma.session.update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } });
  } catch {
    // Eine abgelaufene oder gelöschte Sitzung ist hier unkritisch.
  }
}
