import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { WsHub } from '../../src/server/http/ws-hub';
import { createLogger, registerSecret } from '../../src/server/log';
import { createServices } from '../../src/server/services/index';
import { FakeFinder, FakeTransport, fixture, FAKE_TOKEN } from '../contract/helpers';

// T119 / SC-009 / quality gate 3: run every service and route against an App that returns an email,
// an account name, a CSRF token and secret chat content; then scan logs, every file in the data dir
// and API responses that must not carry identity (quota, health, usage, settings, layout).

const EMAIL = 'boss.private@example.org';
const ACCOUNT = 'Secret Account Name';
const CHAT = 'TOP-SECRET-CHAT-LINE-7731';
const SESSION = 'sweep-session-token-abcdefghijklmnopqrstuvwxyz';

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});

function leakyTransport() {
  const t = new FakeTransport();
  t.handlers.GetUserStatus = () => {
    const us = fixture<{ userStatus: Record<string, unknown> }>('GetUserStatus');
    us.userStatus.email = EMAIL;
    us.userStatus.name = ACCOUNT;
    return us;
  };
  t.handlers.GetCascadeTrajectorySteps = () => {
    const s = fixture<{ steps: { userInput?: { items: { text: string }[]; userResponse: string } }[] }>('GetCascadeTrajectorySteps');
    for (const st of s.steps) if (st.userInput) st.userInput = { items: [{ text: CHAT }], userResponse: CHAT };
    return s;
  };
  t.handlers.SendUserCascadeMessage = () => {
    throw new Error(`upstream echoed ${CHAT} and ${EMAIL} with token ${FAKE_TOKEN}`);
  };
  return t;
}

describe('system-wide leak sweep (SC-009)', () => {
  it('no token, email, account name or chat content in logs, files or identity-free responses', async () => {
    registerSecret(FAKE_TOKEN);
    registerSecret(SESSION);
    const dataDir = await mkdtemp(join(tmpdir(), 'ao-sweep-'));
    dirs.push(dataDir);
    const lines: string[] = [];
    const log = createLogger(
      new Writable({
        write(c, _e, cb) {
          lines.push(c.toString());
          cb();
        },
      }),
    );
    const adapter = createAppAdapter({ finder: new FakeFinder(), transport: leakyTransport(), healthIntervalMs: 60_000 });
    const hub = new WsHub(log);
    const services = createServices({ adapter, hub, log, dataDir, pollIntervalMs: 200 });
    const server = await createHttpServer({ adapter, log, sessionToken: SESSION, hub, services, port: 0, webRoot: '/nonexistent' });
    await adapter.start();
    await services.start();
    const port = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const auth = { authorization: `Bearer ${SESSION}`, 'content-type': 'application/json' };
    await new Promise((r) => setTimeout(r, 800));

    const conv = (await (await fetch(`${base}/api/employees`, { headers: auth })).json()).employees[0].conversationId;
    const identityFree: string[] = [];
    for (const path of ['/api/health', '/api/quota', '/api/usage', '/api/settings', '/api/layout', '/api/models']) {
      identityFree.push(await (await fetch(base + path, { headers: auth })).text());
    }
    // Exercise error paths (they must not echo upstream details).
    const sendErr = await fetch(`${base}/api/conversations/${conv}/messages`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: [{ text: CHAT }], model: 'M' }),
    });
    identityFree.push(await sendErr.text());
    await fetch(`${base}/api/settings`, { method: 'PUT', headers: auth, body: JSON.stringify((await (await fetch(`${base}/api/settings`, { headers: auth })).json())) });
    await new Promise((r) => setTimeout(r, 400));
    await services.stop();
    await server.close();
    await adapter.stop();

    const files = await readdir(dataDir);
    expect(files.length).toBeGreaterThan(0);
    const fileText = (await Promise.all(files.map((f) => readFile(join(dataDir, f), 'utf8')))).join('\n');
    for (const [where, text] of [
      ['logs', lines.join('\n')],
      ['data files', fileText],
      ['API responses', identityFree.join('\n')],
    ] as const) {
      for (const secret of [FAKE_TOKEN, SESSION, EMAIL, ACCOUNT, CHAT]) {
        expect(text, `${secret} leaked into ${where}`).not.toContain(secret);
      }
    }
  });
});
