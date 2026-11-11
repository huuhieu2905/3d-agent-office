import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { WsHub } from '../../src/server/http/ws-hub';
import { createLogger } from '../../src/server/log';
import { createServices } from '../../src/server/services/index';
import type { OfficeLayout } from '../../src/shared/domain';
import { FakeFinder, FakeTransport } from './helpers';

// 007 US5 — contracts/local-api.md L7-2 / L7-3: upload and read frame pictures; unused ones are deleted.

const SESSION = 'session-token-for-picture-routes-0123456789';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup() {
  const dataDir = await mkdtemp(join(tmpdir(), 'ao-pictures-'));
  const log = createLogger(new Writable({ write: (_c, _e, cb) => cb() }));
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport: new FakeTransport(), healthIntervalMs: 60_000 });
  const services = createServices({ adapter, hub: new WsHub(log), log, dataDir, pollIntervalMs: 60_000 });
  const server = await createHttpServer({ adapter, log, sessionToken: SESSION, services, port: 0, webRoot: '/nonexistent' });
  await adapter.start();
  await services.start();
  const port = await server.listen();
  cleanup.push(async () => {
    await server.close();
    await services.stop();
    await adapter.stop();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5 });
  });
  const base = `http://127.0.0.1:${port}`;
  const auth = { authorization: `Bearer ${SESSION}` };
  const upload = (body: Buffer | string, type = 'image/png', headers: Record<string, string> = auth) =>
    fetch(`${base}/api/pictures`, { method: 'POST', headers: { ...headers, 'content-type': type }, body: typeof body === 'string' ? body : new Uint8Array(body) });
  // Over the limit the server answers 413 and closes the socket while the body is still being sent, which
  // makes fetch fail with EPIPE; a raw request reads the status regardless.
  const uploadStatus = (body: Buffer) =>
    new Promise<number>((resolve, reject) => {
      const req = request(`${base}/api/pictures`, { method: 'POST', headers: { ...auth, 'content-type': 'image/png', 'content-length': body.length } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', (err) => setTimeout(() => reject(err), 500)); // a response that already arrived wins
      req.end(body);
    });
  const get = (id: string) => fetch(`${base}/api/pictures/${id}`, { headers: auth });
  const layout = async (): Promise<OfficeLayout> => (await fetch(`${base}/api/layout`, { headers: auth })).json() as Promise<OfficeLayout>;
  const putLayout = (l: OfficeLayout) => fetch(`${base}/api/layout`, { method: 'PUT', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(l) });
  return { dataDir, upload, uploadStatus, get, layout, putLayout };
}

describe('L7-2 / L7-3 pictures', () => {
  it('201 stores a picture (mode 0600) and serves it back with a fixed type', async () => {
    const t = await setup();
    const res = await t.upload(PNG);
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f]{32}\.png$/);
    expect((await stat(join(t.dataDir, 'pictures', id))).mode & 0o777).toBe(0o600);
    const back = await t.get(id);
    expect(back.status).toBe(200);
    expect(back.headers.get('content-type')).toBe('image/png');
    expect(back.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await back.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it('400 wrong magic bytes, 415 other types, 413 over 2 MB, 401 without the token', async () => {
    const t = await setup();
    expect((await t.upload(Buffer.from('not really a png at all'))).status).toBe(400);
    expect((await t.upload('hello', 'text/plain')).status).toBe(415);
    expect(await t.uploadStatus(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]))).toBe(413);
    expect((await t.upload(PNG, 'image/png', {})).status).toBe(401);
  });

  it('400 for a bad id (no path traversal), 404 for a missing picture', async () => {
    const t = await setup();
    expect((await t.get('..%2Flayout.json')).status).toBe(400);
    expect((await t.get(`${'0'.repeat(32)}.png`)).status).toBe(404);
  });

  it('a layout save deletes pictures no frame uses and keeps the ones in use', async () => {
    const t = await setup();
    const used = ((await (await t.upload(PNG)).json()) as { id: string }).id;
    const orphan = ((await (await t.upload(PNG)).json()) as { id: string }).id;
    const l = await t.layout();
    // A photo frame on the inside of the west outer wall, showing `used`.
    l.items.push({ id: 'pf', type: 'photo_frame', pos: { x: 0, z: 6 }, rotation: 90, picture: used });
    expect((await t.putLayout(l)).status).toBe(200);
    expect(await readdir(join(t.dataDir, 'pictures'))).toEqual([used]);
    expect(orphan).not.toBe(used);
  });
});
