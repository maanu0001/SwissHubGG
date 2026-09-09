import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, userHasPermission } from '@/lib/auth/session';
import { PERMISSIONS } from '@/lib/permissions';
import { AUDIT_ACTIONS, recordAudit } from '@/lib/audit';

/**
 * CSV-Export der Kontaktanfragen.
 * Nur mit ausdrücklicher Exportberechtigung; jeder Export wird protokolliert.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Verhindert, dass Tabellenprogramme Zellinhalte als Formel auswerten. */
function csvCell(value: string | null | undefined): string {
  const raw = (value ?? '').replace(/\r?\n/g, ' ').trim();
  const guarded = /^[=+\-@\t]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!userHasPermission(user, PERMISSIONS.CONTACT_EXPORT)) {
    return new NextResponse('Nicht gefunden', { status: 404 });
  }

  const requests = await prisma.contactRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      reference: true,
      createdAt: true,
      status: true,
      priority: true,
      name: true,
      email: true,
      organisation: true,
      subject: true,
      message: true,
      anonymizedAt: true,
      category: { select: { label: true } },
      assignedTo: { select: { displayName: true } },
    },
  });

  const header = [
    'Referenz',
    'Eingegangen',
    'Status',
    'Prioritaet',
    'Kategorie',
    'Name',
    'E-Mail',
    'Organisation',
    'Betreff',
    'Nachricht',
    'Zustaendig',
    'Anonymisiert',
  ];

  const rows = requests.map((request) =>
    [
      csvCell(request.reference),
      csvCell(request.createdAt.toISOString()),
      csvCell(request.status),
      csvCell(request.priority),
      csvCell(request.category?.label),
      csvCell(request.name),
      csvCell(request.email),
      csvCell(request.organisation),
      csvCell(request.subject),
      csvCell(request.message),
      csvCell(request.assignedTo?.displayName),
      csvCell(request.anonymizedAt ? 'ja' : 'nein'),
    ].join(';'),
  );

  // BOM, damit Excel die Umlaute korrekt erkennt.
  const csv = `﻿${header.map(csvCell).join(';')}\n${rows.join('\n')}\n`;

  await recordAudit({
    action: AUDIT_ACTIONS.CONTACT_EXPORT,
    entityType: 'ContactRequest',
    summary: `${requests.length} Kontaktanfrage(n) als CSV exportiert.`,
    actor: user,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="swisshub-kontaktanfragen-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
