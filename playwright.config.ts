import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4399);

// E2E runs against a mock Antigravity App (tests/e2e/mock-app.ts), never the real App.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1920, height: 1080 } },
  webServer: {
    command: `npm run build && tsx tests/e2e/start-with-mock.ts`,
    url: `http://127.0.0.1:${port}/api/health-public`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_PORT: String(port) },
  },
});
