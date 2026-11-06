import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const live = process.env.AGENT_OFFICE_LIVE === '1';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: live
      ? ['tests/live/**/*.test.ts']
      : ['tests/unit/**/*.test.ts', 'tests/contract/**/*.test.ts', 'tests/leaks/**/*.test.ts'],
    testTimeout: live ? 15 * 60_000 : 10_000,
    passWithNoTests: true,
  },
});
