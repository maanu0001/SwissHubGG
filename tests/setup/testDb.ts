import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Testdatenbank.
 *
 * Die Integrationstests laufen gegen eine echte PostgreSQL-Datenbank, damit
 * Constraints, Transaktionen und Prisma-Verhalten wirklich geprüft werden.
 * Die Datenbank wird über DATABASE_URL_TEST angesteuert.
 */

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error('Für die Tests muss DATABASE_URL_TEST oder DATABASE_URL gesetzt sein.');
}

process.env.DATABASE_URL = url;
process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret-1234';
process.env.APP_URL ??= 'http://localhost:3000';
// NODE_ENV setzt Vitest selbst auf 'test'.

let prepared = false;

/** Bringt das Schema einmalig auf den aktuellen Stand. */
export function prepareSchema(): void {
  if (prepared) return;
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });
  prepared = true;
}

export const testPrisma = new PrismaClient({ datasources: { db: { url } } });

/** Leert alle Tabellen, ohne das Schema neu aufzubauen. */
export async function resetDatabase(): Promise<void> {
  const tables = await testPrisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%';
  `;

  if (tables.length === 0) return;

  const list = tables.map((table) => `"public"."${table.tablename}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}
