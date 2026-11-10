import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { createLogger } from '../../src/server/log';
import { SettingsStore } from '../../src/server/services/settings';
import { settingsSchema } from '../../src/shared/schemas';
import { FakeFinder, FakeTransport } from '../contract/helpers';

// 004 T006 (data-model §1, L4-2): the new settings fields are optional, so a settings.json written before
// 004 still parses — JsonStore would otherwise silently reset it to defaults.

const OLD = { schemaVersion: 1, city: 'tokyo', theme: 'dark', detailLevel: 'high', autoLowerDetail: false, camera: 'first_person', defaultModel: 'm1' };

describe('settings compatibility (004)', () => {
  it('a pre-004 settings.json keeps its values', async () => {
    expect(settingsSchema.safeParse(OLD).success).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), 'ao-settings-'));
    writeFileSync(join(dir, 'settings.json'), JSON.stringify(OLD));
    const s = await new SettingsStore(dir).get();
    expect(s.city).toBe('tokyo');
    expect(s.theme).toBe('dark');
  });

  it('accepts the new fields within limits and rejects oversized screensOff', () => {
    expect(settingsSchema.safeParse({ ...OLD, legendCollapsed: true, screensOff: ['a', 'b'] }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...OLD, screensOff: Array.from({ length: 51 }, (_, i) => `s${i}`) }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...OLD, screensOff: ['x'.repeat(101)] }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...OLD, screensOff: [''] }).success).toBe(false);
  });

  it('PUT /api/settings rejects a wrongly typed new field with 400', async () => {
    const SESSION = 'session-token-for-settings-compat-0123456789';
    const adapter = createAppAdapter({ finder: new FakeFinder(), transport: new FakeTransport(), healthIntervalMs: 60_000 });
    const settings = new SettingsStore(mkdtempSync(join(tmpdir(), 'ao-settings-')));
    const server = await createHttpServer({ adapter, log: createLogger(), sessionToken: SESSION, port: 0, webRoot: '/nonexistent', services: { settings } as never });
    const port = await server.listen();
    try {
      const put = (body: unknown) =>
        fetch(`http://127.0.0.1:${port}/api/settings`, {
          method: 'PUT',
          headers: { authorization: `Bearer ${SESSION}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      expect((await put({ ...OLD, legendCollapsed: 'yes' })).status).toBe(400);
      expect((await put({ ...OLD, screensOff: 'abc' })).status).toBe(400);
      expect((await put({ ...OLD, legendCollapsed: true })).status).toBe(200);
    } finally {
      await server.close();
      await adapter.stop();
    }
  });
});
