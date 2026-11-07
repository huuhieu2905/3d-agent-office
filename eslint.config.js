import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Constitution II: only src/server/app-adapter/index.ts is the public API of the adapter.
const adapterInternals = {
  group: ['**/app-adapter/*', '**/app-adapter/**', '!**/app-adapter/index', '!**/app-adapter/index.ts', '!**/app-adapter/index.js'],
  message: 'Only import src/server/app-adapter/index.ts (Constitution II).',
};

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', 'coverage/', 'playwright-report/', 'test-results/', 'assets/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/server/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],
    ignores: ['src/server/app-adapter/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [adapterInternals] }] },
  },
  {
    files: ['tests/contract/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/server/**'], message: 'The web client must not import server code.' }] },
      ],
    },
  },
);
