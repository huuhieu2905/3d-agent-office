import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation, recordRaw } from '../../src/server/app-adapter/index';
import type { Step } from '../../src/shared/domain';
import { sweepTestArtifacts } from './sweep';

// Spec 003 T011 (R3-09, FR-003): answer a real permission request with allow, then deny.
// If the App auto-runs commands (its own setting), the test is skipped — verify by hand (quickstart M4).
// The App's settings are never changed here. AGENT_OFFICE_RECORD=1 also records waiting-steps.json.

beforeAll(async () => {
  await sweepTestArtifacts();
}, 120_000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(a: ReturnType<typeof createAppAdapter>, id: string, pred: (s: Step) => boolean, ms: number): Promise<Step | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = (await a.getSteps(id)).find(pred);
    if (hit) return hit;
    await sleep(500);
  }
  return null;
}

describe('live: permission requests', () => {
  it('allows one command and denies another', async (ctx) => {
    const a = createAppAdapter();
    await a.start();
    expect(a.getConnection().kind).toBe('connected');
    let id: string | null = null;
    try {
      const models = await a.getModels();
      const model = models.find((m) => /Flash/.test(m.label))?.modelId ?? models[0]!.modelId;
      ({ conversationId: id } = await a.startConversation({
        parts: [{ text: '[agent-office-test] permission. Run exactly this shell command: echo agent-office-permission-1 . Then stop.' }],
        model,
      }));
      const waiting = await waitFor(a, id, (s) => s.status === 'WAITING' && s.kind === 'permission_request', 60_000);
      if (!waiting) {
        const ran = (await a.getSteps(id)).some((s) => s.kind === 'command');
        ctx.skip(ran ? 'App đang tự duyệt lệnh, kiểm chứng bằng tay quickstart M4' : 'Agent không xin chạy lệnh trong 60 s');
        return;
      }

      if (process.env.AGENT_OFFICE_RECORD === '1') {
        const conn = a.getConnection();
        const version = conn.kind === 'connected' ? conn.appVersion : 'unknown';
        const dir = join(import.meta.dirname, '..', 'contract', 'fixtures', `app-${version}`);
        await mkdir(dir, { recursive: true });
        const raw = await recordRaw('GetCascadeTrajectorySteps', { cascadeId: id });
        await writeFile(join(dir, 'waiting-steps.json'), JSON.stringify(raw, null, 2) + '\n');
      }

      await a.answerPermission(id, waiting.permission!.requestId, 'allow');
      const answered = await waitFor(a, id, (s) => s.index === waiting.index && s.status !== 'WAITING', 20_000);
      expect(answered).not.toBeNull();

      await a.sendMessage(id, { parts: [{ text: 'Now run exactly this shell command: echo agent-office-permission-2 . Then stop.' }], model });
      const second = await waitFor(a, id, (s) => s.index > waiting.index && s.status === 'WAITING' && s.kind === 'permission_request', 60_000);
      expect(second).not.toBeNull();
      await a.answerPermission(id, second!.permission!.requestId, 'deny');
      const denied = await waitFor(a, id, (s) => s.index === second!.index && s.status !== 'WAITING', 20_000);
      expect(denied).not.toBeNull();
    } finally {
      await a.stop();
      if (id) await deleteTestConversation(id).catch(() => undefined);
    }
  });
});
