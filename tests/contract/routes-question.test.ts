import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { RpcError } from '../../src/server/app-adapter/types';
import { createHttpServer } from '../../src/server/http/app';
import { createLogger } from '../../src/server/log';
import { FakeFinder, FakeTransport } from './helpers';

// Spec 003 L3-1: POST /api/conversations/:id/questions/:requestId → 202 / 400 / 409 / 422.

const SESSION = 'session-token-for-question-route-0123456789';
const TRAJ = '76f2ef1e-f785-4c90-b4b1-22ffaa590698';
const CONV = '00000000-0000-4000-8000-0000000000c1';
const REQ = `${TRAJ}:1:askQuestion`;
const questions = [
  { question: 'Pick one', options: [{ id: '1', text: 'A' }, { id: '2', text: 'B' }] },
  { question: 'Pick many', options: [{ id: '1', text: 'X' }, { id: '2', text: 'Y' }], isMultiSelect: true },
];

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!();
});

async function setup(status = 'CORTEX_STEP_STATUS_WAITING') {
  const transport = new FakeTransport();
  const sent: unknown[] = [];
  transport.handlers.GetCascadeTrajectorySteps = () => ({
    steps: [{}, { type: 'CORTEX_STEP_TYPE_ASK_QUESTION', status, metadata: { sourceTrajectoryStepInfo: { trajectoryId: TRAJ } }, askQuestion: { questions } }],
  });
  transport.handlers.HandleCascadeUserInteraction = (b) => (sent.push(b), {});
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
  await adapter.start();
  let refreshed = 0;
  const services = { employees: { refresh: async () => void refreshed++ } } as never;
  const server = await createHttpServer({ adapter, log: createLogger(), sessionToken: SESSION, port: 0, webRoot: '/nonexistent', services });
  const port = await server.listen();
  cleanup.push(async () => {
    await server.close();
    await adapter.stop();
  });
  const post = (body: unknown, req = REQ) =>
    fetch(`http://127.0.0.1:${port}/api/conversations/${CONV}/questions/${encodeURIComponent(req)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SESSION}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { post, sent, transport, refreshed: () => refreshed };
}

const ok = { answers: [{ selectedOptionIds: ['2'] }, { selectedOptionIds: ['1', '2'], writeIn: 'và thêm' }] };

describe('L3-1 question answers', () => {
  it('202 — forwards a valid answer and refreshes employees', async () => {
    const t = await setup();
    const res = await t.post(ok);
    expect(res.status).toBe(202);
    expect(t.sent).toHaveLength(1);
    expect(t.refreshed()).toBe(1);
  });

  it('400 — malformed body, missing answer, too many choices, unknown id, bad request id', async () => {
    const t = await setup();
    for (const body of [
      { nope: 1 },
      { answers: [{ selectedOptionIds: ['1'] }] },
      { answers: [{ selectedOptionIds: ['1', '2'] }, { selectedOptionIds: ['1'] }] },
      { answers: [{ selectedOptionIds: ['9'] }, { selectedOptionIds: ['1'] }] },
    ]) {
      expect((await t.post(body)).status).toBe(400);
    }
    expect((await t.post(ok, `${TRAJ}:1:permission`)).status).toBe(400);
    expect(t.sent).toEqual([]);
  });

  it('409 — the question was already answered elsewhere', async () => {
    const t = await setup('CORTEX_STEP_STATUS_DONE');
    const res = await t.post(ok);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('QUESTION_NOT_PENDING');
    expect(t.sent).toEqual([]);
  });

  it('422 — the App rejects the answer; its message is not passed on', async () => {
    const t = await setup();
    t.transport.handlers.HandleCascadeUserInteraction = () => {
      throw new RpcError('protocol', 'HandleCascadeUserInteraction: HTTP 400 secret-app-detail', 400);
    };
    const res = await t.post(ok);
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(text).toContain('APP_REJECTED');
    expect(text).not.toContain('secret-app-detail');
  });
});
