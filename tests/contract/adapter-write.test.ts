// Body contract: what the adapter sends does not depend on a recorded fixture set, so it runs once (FR-006).
import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { FakeFinder, FakeTransport } from './helpers';

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

async function setup() {
  const transport = new FakeTransport();
  const sent: { method: string; body: unknown }[] = [];
  for (const m of ['SendUserCascadeMessage', 'CancelCascadeInvocation']) {
    transport.handlers[m] = (body) => {
      sent.push({ method: m, body });
      return {};
    };
  }
  transport.handlers.StartCascade = (body) => {
    sent.push({ method: 'StartCascade', body });
    return { cascadeId: 'new-cascade-id' };
  };
  const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
  await adapter.start();
  stops.push(() => adapter.stop());
  return { adapter, sent, transport };
}

describe('adapter writes (contracts/app-adapter.md)', () => {
  it('sendMessage sends a user message with text and file mentions', async () => {
    const { adapter, sent } = await setup();
    await adapter.sendMessage('c1', {
      parts: [{ text: 'Xem ' }, { mention: { kind: 'file', uri: 'file:///tmp/a.ts', label: 'a.ts' } }, { text: ' giúp mình' }],
      model: 'MODEL_X',
    });
    expect(sent[0]).toEqual({
      method: 'SendUserCascadeMessage',
      body: {
        cascadeId: 'c1',
        items: [{ text: 'Xem ' }, { item: { file: { absoluteUri: 'file:///tmp/a.ts' } } }, { text: ' giúp mình' }],
        cascadeConfig: { plannerConfig: { planModel: 'MODEL_X' } },
      },
    });
  });

  it('cancel sends CancelCascadeInvocation', async () => {
    const { adapter, sent } = await setup();
    await adapter.cancel('c1');
    expect(sent).toEqual([{ method: 'CancelCascadeInvocation', body: { cascadeId: 'c1' } }]);
  });

  it('startConversation uses the spike-verified StartCascade body, then sends the first message', async () => {
    const { adapter, sent } = await setup();
    const res = await adapter.startConversation({ parts: [{ text: 'hello' }], model: 'M', projectId: 'p1' });
    expect(res).toEqual({ conversationId: 'new-cascade-id' });
    expect(sent[0]).toEqual({
      method: 'StartCascade',
      body: {
        source: 'CORTEX_TRAJECTORY_SOURCE_INTERACTIVE_CASCADE',
        projectEnvConfig: { projectId: 'p1', defaultProjectEnvironment: {} },
      },
    });
    expect(sent[1]).toMatchObject({ method: 'SendUserCascadeMessage', body: { cascadeId: 'new-cascade-id' } });
  });

  it.each([
    [['p1', 'default-cli-project', 'outside-of-project'], 'default-cli-project'],
    [['p1', 'outside-of-project'], 'outside-of-project'], // fresh Linux App: no CLI project (spec 005)
    [['p1'], undefined],
  ])('startConversation without a project uses a default project the App has (%j)', async (projectIds, expected) => {
    const { adapter, sent, transport } = await setup();
    transport.handlers.ListProjects = () => ({ projectIds });
    await adapter.startConversation({ parts: [{ text: 'hello' }], model: 'M' });
    expect((sent[0]!.body as { projectEnvConfig: unknown }).projectEnvConfig).toEqual(
      expected ? { projectId: expected, defaultProjectEnvironment: {} } : { defaultProjectEnvironment: {} },
    );
  });

  it('getModels reads labels, model ids and remaining quota from GetUserStatus', async () => {
    const { adapter } = await setup();
    const models = await adapter.getModels();
    expect(models.length).toBeGreaterThan(3);
    for (const m of models) {
      expect(m.modelId).toMatch(/^MODEL_/);
      expect(m.label.length).toBeGreaterThan(0);
      if (m.remainingPercent != null) expect(m.remainingPercent).toBeGreaterThanOrEqual(0);
    }
  });
});
