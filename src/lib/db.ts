import { PrismaClient } from '@prisma/client';

/**
 * Prisma-Singleton. Im Entwicklungsmodus wird die Instanz über Hot Reloads
 * hinweg wiederverwendet, damit keine Verbindungen auslaufen.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
