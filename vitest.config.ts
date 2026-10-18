import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@skuf-skills/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
      '@skuf-skills/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['apps/api/test/**/*.test.ts', 'packages/**/test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.ts', 'apps/web/src/**/*.test.tsx'],
          setupFiles: ['apps/web/src/test/setup.ts'],
        },
      },
      {
        test: {
          name: 'worker',
          environment: 'node',
          include: ['apps/worker/test/**/*.test.ts'],
        },
      },
    ],
  },
});
