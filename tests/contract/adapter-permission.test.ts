import { afterEach, describe, expect, it } from 'vitest';
import { createAppAdapter } from '../../src/server/app-adapter/index';
import { mapSteps } from '../../src/server/app-adapter/mappers/step';
import { computeVisualState } from '../../src/server/services/visual-state';
import type { Conversation } from '../../src/shared/domain';
import { FakeFinder, FakeTransport, fixture } from './helpers';

// Spikes T029/T084 (2026-11-06): waiting-for-approval and error steps observed on App 2.24.0.

const stops: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (stops.length) await stops.pop()!();
});

const conv = (runStatus: Conversation['runStatus']): Conversation => ({
  id: 'c',
  title: 't',
  projectId: null,
  parentId: null,
  runStatus,
  stepCount: 7,
  lastActivityAt: new Date().toISOString(),
  lastUserInputAt: null,
  workspaceUris: [],
  currentModel: null,
});
const connected = { kind: 'connected', appVersion: '2.24.0', versionSupported: true } as const;

describe('waiting for approval', () => {
  const steps = mapSteps(fixture('waiting-steps'));
  const last = steps.at(-1)!;

  it('maps the WAITING GENERIC step to a permission request with a usable id', () => {
    expect(last.status).toBe('WAITING');
    expect(last.kind).toBe('permission_request');
    expect(last.permission?.requestId).toMatch(/^[0-9a-f-]{36}:6:permission$/);
    expect(last.permission?.description).toContain('echo second_check');
  });

  it('shows the employee as waiting_for_boss while the run is RUNNING', () => {
    expect(computeVisualState(conv('RUNNING'), last, connected)).toBe('waiting_for_boss');
  });
});

describe('error after a denied command', () => {
  it('maps RUN_COMMAND ERROR as a command step with ERROR status', () => {
    const steps = mapSteps(fixture('error-steps'));
    const err = steps.find((s) => s.status === 'ERROR');
    expect(err).toBeDefined();
    expect(err!.kind).toBe('command');
  });
});

describe('answerPermission', () => {
  it('sends HandleCascadeUserInteraction with cascadeId, trajectoryId, stepIndex and allow/deny', async () => {
    const transport = new FakeTransport();
    const sent: unknown[] = [];
    transport.handlers.HandleCascadeUserInteraction = (b) => (sent.push(b), {});
    const adapter = createAppAdapter({ finder: new FakeFinder(), transport, healthIntervalMs: 60_000 });
    await adapter.start();
    stops.push(() => adapter.stop());
    const id = mapSteps(fixture('waiting-steps')).at(-1)!.permission!.requestId;
    await adapter.answerPermission('conv-1', id, 'allow');
    await adapter.answerPermission('conv-1', id, 'deny');
    const traj = id.split(':')[0];
    expect(sent).toEqual([
      { cascadeId: 'conv-1', interaction: { trajectoryId: traj, stepIndex: 6, permission: { allow: true } } },
      { cascadeId: 'conv-1', interaction: { trajectoryId: traj, stepIndex: 6, permission: { allow: false } } },
    ]);
  });
});
