import { beforeAll, describe, expect, it } from 'vitest';
import { createAppAdapter, deleteTestConversation } from '../../src/server/app-adapter/index';
import { WsHub } from '../../src/server/http/ws-hub';
import { createLogger } from '../../src/server/log';
import { createServices } from '../../src/server/services/index';
import type { RunStatus, VisualState } from '../../src/shared/domain';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sweepTestArtifacts } from './sweep';

// T059 / quality gate 2 (FR-003, SC-002). Runs only with AGENT_OFFICE_LIVE=1 against the real App.
// Creates "[agent-office-test] latency", keeps the agent busy, and samples App status vs. published
// VisualState every 250 ms. Duration: LATENCY_MINUTES (default 10).

const MINUTES = Number(process.env.LATENCY_MINUTES ?? 10);
const isRunning = (s: RunStatus) => s === 'RUNNING' || s === 'BUSY';
const isBusyVisual = (v: VisualState) => v === 'working' || v === 'thinking' || v === 'waiting_for_boss';

beforeAll(async () => {
  await sweepTestArtifacts();
}, 120_000);

describe('live: status latency and accuracy', () => {
  it(`p95 latency ≤ 2 s and ≥ 99% agreement over ${MINUTES} min`, async () => {
    const adapter = createAppAdapter();
    await adapter.start();
    expect(adapter.getConnection().kind).toBe('connected');
    const hub = new WsHub(createLogger());
    const published = new Map<string, { state: VisualState; at: number }>();
    hub.broadcast = (m) => {
      if (m.type === 'employees.patch')
        for (const e of m.payload.upserted) published.set(e.conversationId, { state: e.visualState, at: Date.now() });
    };
    const services = createServices({ adapter, hub, log: createLogger(), dataDir: await mkdtemp(join(tmpdir(), 'ao-live-')) });
    await services.start();

    const model = (await adapter.getModels())[0]?.modelId ?? 'MODEL_PLACEHOLDER_M318';
    const projects = await adapter.listProjects();
    const { conversationId: id } = await adapter.startConversation({
      parts: [{ text: '[agent-office-test] latency' }],
      model,
      projectId: projects.find((p) => p.id === 'default-cli-project')?.id,
    });
    const prompts = [
      'Write a 600-word essay about office plants. No tools.',
      'Now write a 600-word essay about city parks. No tools.',
      'Now write a 600-word essay about rivers. No tools.',
    ];

    let agree = 0;
    let total = 0;
    const latencies: number[] = [];
    let lastApp: RunStatus | null = null;
    let changedAt = 0;
    let waitingFor: boolean | null = null;
    const end = Date.now() + MINUTES * 60_000;
    let p = 0;
    try {
      while (Date.now() < end) {
        const conv = (await adapter.listConversations()).find((c) => c.id === id);
        const app = conv?.runStatus ?? 'UNKNOWN';
        if (app === 'IDLE' && p < 1000 && (lastApp === null || lastApp === 'IDLE')) {
          await adapter.sendMessage(id, { parts: [{ text: prompts[p++ % prompts.length]! }], model });
        }
        if (app !== lastApp) {
          changedAt = Date.now();
          waitingFor = isRunning(app);
          lastApp = app;
        }
        const pub = published.get(id);
        if (waitingFor !== null && pub && isBusyVisual(pub.state) === waitingFor && pub.at >= changedAt - 50) {
          latencies.push(pub.at - changedAt);
          waitingFor = null;
        }
        // Agreement: allow the 2 s budget right after a change.
        if (Date.now() - changedAt > 2000 && pub) {
          total++;
          if (isBusyVisual(pub.state) === isRunning(app)) agree++;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      await adapter.cancel(id).catch(() => undefined);
      await services.stop();
      await adapter.stop();
      await deleteTestConversation(id).catch(() => undefined);
    }
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? Infinity;
    console.log(`transitions=${latencies.length} p95=${p95}ms agreement=${((agree / Math.max(1, total)) * 100).toFixed(2)}% (n=${total})`);
    expect(latencies.length).toBeGreaterThan(0);
    expect(p95).toBeLessThanOrEqual(2000);
    expect(agree / Math.max(1, total)).toBeGreaterThanOrEqual(0.99);
  });
});
