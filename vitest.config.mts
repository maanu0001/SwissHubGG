import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Integrationstests teilen sich eine Datenbank und laufen daher nacheinander.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` ist eine reine Bau-Zeit-Markierung. In den Tests laufen
      // die Module direkt in Node, deshalb wird sie durch eine leere Datei ersetzt.
      'server-only': fileURLToPath(new URL('./tests/setup/serverOnlyStub.ts', import.meta.url)),
    },
  },
});
