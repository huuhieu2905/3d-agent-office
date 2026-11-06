import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { createLogger, redactString, registerSecret } from '../../src/server/log';
import { createHttpServer } from '../../src/server/http/app';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { JsonStore } from '../../src/server/storage/json-store';
import { settingsSchema } from '../../src/shared/schemas';
import { FakeFinder, FakeTransport, FAKE_TOKEN } from '../contract/helpers';

// SC-009 / FR-081: no token, email or message content in logs, files or API responses.

const SECRET_EMAIL = 'someone.private@example.com';
const SECRET_CONTENT = 'TOP-SECRET-CHAT-CONTENT-42';
const SESSION = 'session-token-for-leak-test-0123456789';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, logger: createLogger(stream) };
}

function assertClean(text: string) {
  expect(text).not.toContain(FAKE_TOKEN);
  expect(text).not.toContain(SESSION);
  expect(text).not.toContain(SECRET_EMAIL);
  expect(text).not.toContain(SECRET_CONTENT);
}

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

describe('logger redaction', () => {
  it('censors sensitive keys and free-text secrets', async () => {
    registerSecret(FAKE_TOKEN);
    registerSecret(SESSION);
    const { lines, logger } = capture();
    logger.info({ csrfToken: FAKE_TOKEN, email: SECRET_EMAIL, text: SECRET_CONTENT, nested: { content: SECRET_CONTENT } }, 'obj');
    logger.info(`args: --csrf_token ${FAKE_TOKEN} user ${SECRET_EMAIL} url /#k=${SESSION}`);
    logger.error({ err: new Error(`boom x-codeium-csrf-token: ${FAKE_TOKEN} for ${SECRET_EMAIL}`) }, 'failed');
    await new Promise((r) => setTimeout(r, 20));
    assertClean(lines.join('\n'));
  });

  it('redactString handles tokens, emails and session links', () => {
    const out = redactString(`--csrf_token=${FAKE_TOKEN} ${SECRET_EMAIL} http://127.0.0.1:4317/#k=${SESSION}`);
    assertClean(out);
  });
});

describe('server responses and persisted files', () => {
  it('error responses and files in the data dir contain no secrets', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'agent-office-leak-'));
    dirs.push(dataDir);
    const { lines, logger } = capture();
    const adapter = createAppAdapter({ finder: new FakeFinder(), transport: new FakeTransport(), healthIntervalMs: 60_000 });
    await adapter.start();
    const server = await createHttpServer({ adapter, log: logger, sessionToken: SESSION, port: 0, webRoot: '/nonexistent' });
    const port = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const bodies: string[] = [];
    for (const [path, headers] of [
      ['/api/health', { authorization: `Bearer ${SESSION}` }],
      ['/api/health', {}],
      ['/api/health', { authorization: 'Bearer wrong' }],
      ['/api/does-not-exist', { authorization: `Bearer ${SESSION}` }],
    ] as const) {
      const res = await fetch(base + path, { headers });
      bodies.push(await res.text());
    }
    const store = new JsonStore(dataDir, {
      file: 'settings.json',
      schema: settingsSchema,
      defaults: () => ({ schemaVersion: 1 as const, city: 'hanoi' as const, theme: 'light' as const, detailLevel: 'medium' as const, autoLowerDetail: true, camera: 'overview' as const, defaultModel: null }),
    });
    await store.write(await store.read());
    await server.close();
    await adapter.stop();

    const files = await readdir(dataDir);
    const fileText = (await Promise.all(files.map((f) => readFile(join(dataDir, f), 'utf8')))).join('\n');
    assertClean(bodies.join('\n') + lines.join('\n') + fileText);
  });
});
