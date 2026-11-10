// Starts the real Agent Office server wired to an in-process MockApp (used by playwright.config.ts).
// A control endpoint on E2E_PORT+1 lets tests make the "App" quit, open or restart.
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { createHttpServer } from '../../src/server/http/app';
import { WsHub } from '../../src/server/http/ws-hub';
import { createLogger } from '../../src/server/log';
import { createServices } from '../../src/server/services/index';
import { MockApp } from './mock-app';

export const E2E_TOKEN = 'e2e-session-token-0123456789abcdefghij';
const port = Number(process.env.E2E_PORT ?? 4399);

const mock = new MockApp();
const log = createLogger();
const adapter = createAppAdapter({ finder: mock.finder, transport: mock.transport, healthIntervalMs: 500 });
const hub = new WsHub(log);
const fakeHome = mkdtempSync(join(tmpdir(), 'ao-e2e-home-'));
mkdirSync(join(fakeHome, 'code', 'website'), { recursive: true });
mkdirSync(join(fakeHome, 'Documents'));
const services = createServices({ adapter, hub, log, dataDir: mkdtempSync(join(tmpdir(), 'ao-e2e-')), pollIntervalMs: 500, homeDir: fakeHome });
const server = await createHttpServer({ adapter, log, sessionToken: E2E_TOKEN, hub, services, port });
adapter.onConnectionChange((s) => hub.broadcast({ type: 'connection', payload: s }));
hub.onClientConnect((send) => send({ type: 'connection', payload: adapter.getConnection() }));
await adapter.start();
await services.start();
await server.listen();

createServer((req, res) => {
  const action = req.url?.slice(1);
  if (action === 'quit') mock.quit();
  else if (action === 'open') mock.open();
  else if (action === 'restart') mock.restart();
  else if (action === 'running') mock.runningAll = true;
  else if (action === 'idle') mock.runningAll = false;
  else if (action === 'waiting') {
    mock.waiting = true;
    mock.runningAll = true;
  }
  else if (action === 'reset') {
    mock.sent = [];
    mock.runningAll = false;
    mock.waiting = false;
    mock.created = [];
    mock.hiddenModels.clear();
    mock.extraSteps = [];
    mock.question = null;
    mock.answeredWith = null;
    mock.rejectQuestion = false;
    mock.deleted.clear();
    mock.runningIds.clear();
    mock.parents = {};
    mock.failDelete = false;
    mock.projectPerConversation = false;
  }
  else if (action === 'error-and-search') mock.addErrorAndSearchSteps();
  else if (action === 'delete-fail') mock.failDelete = true;
  else if (action === 'many-projects') mock.projectPerConversation = true;
  else if (action?.startsWith('run/')) mock.runningIds.add(action.slice('run/'.length));
  else if (action?.startsWith('idle/')) mock.runningIds.delete(action.slice('idle/'.length));
  else if (action?.startsWith('parent/')) {
    const [child, parent] = action.slice('parent/'.length).split('/');
    if (child && parent) mock.parents[child] = parent;
  }
  else if (action === 'question') {
    mock.question = 'waiting';
    mock.runningAll = true;
  }
  else if (action === 'question-cancel') mock.question = 'canceled';
  else if (action === 'question-reject') mock.rejectQuestion = true;
  else if (action?.startsWith('hide-model/')) mock.hiddenModels.add(action.slice('hide-model/'.length));
  else if (action === 'sent') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(mock.sent));
  }
  res.end('ok');
}).listen(port + 1, '127.0.0.1');

console.log(`e2e server on ${port}, control on ${port + 1}`);
