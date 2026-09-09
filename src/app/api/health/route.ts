import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Healthcheck für Docker und Reverse Proxy.
 *
 * Prüft, ob die Anwendung läuft und die Datenbank erreichbar ist. Die Antwort
 * enthält bewusst keine internen Details.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', reason: 'database' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
