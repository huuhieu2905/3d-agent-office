import { describe, expect, it } from 'vitest';
import type { ConnectionState, Conversation, Step, StepStatus } from '../../src/shared/domain';
import { computeVisualState, STICKY_MS } from '../../src/server/services/visual-state';

const connected: ConnectionState = { kind: 'connected', appVersion: '2.24.0', versionSupported: true };

const conv = (runStatus: Conversation['runStatus'], lastUserInputAt: string | null = null): Conversation => ({
  id: 'c1',
  title: 'x',
  projectId: null,
  parentId: null,
  runStatus,
  stepCount: 3,
  lastActivityAt: '2026-11-06T10:00:00Z',
  lastUserInputAt,
  workspaceUris: [],
  currentModel: null,
});

const step = (status: StepStatus, kind: Step['kind'] = 'agent', createdAt = '2026-11-06T10:00:00Z'): Step => ({
  index: 2,
  kind,
  status,
  createdAt,
  text: null,
  thinking: null,
  toolCalls: [],
  mentions: [],
  command: null,
  file: null,
  permission: kind === 'permission_request' ? { requestId: 'r', description: 'd', options: [] } : null,
  rawType: 'PLANNER_RESPONSE',
  model: null,
});

const NOW = Date.parse('2026-11-06T10:01:00Z');

describe('computeVisualState — data-model §6 priority table', () => {
  it('1. disconnected wins over everything', () => {
    expect(computeVisualState(conv('RUNNING'), step('WAITING'), { kind: 'searching' }, NOW)).toBe('disconnected');
  });
  it('2. last step WAITING → waiting_for_boss', () => {
    expect(computeVisualState(conv('RUNNING'), step('WAITING'), connected, NOW)).toBe('waiting_for_boss');
  });
  it('2. unanswered permission request → waiting_for_boss', () => {
    expect(computeVisualState(conv('IDLE'), step('PENDING', 'permission_request'), connected, NOW)).toBe('waiting_for_boss');
  });
  it('3. ERROR while IDLE → error', () => {
    expect(computeVisualState(conv('IDLE'), step('ERROR'), connected, NOW)).toBe('error');
  });
  it('4. running and generating → thinking', () => {
    expect(computeVisualState(conv('RUNNING'), step('GENERATING'), connected, NOW)).toBe('thinking');
    expect(computeVisualState(conv('BUSY'), step('GENERATING'), connected, NOW)).toBe('thinking');
  });
  it('5. running otherwise → working', () => {
    expect(computeVisualState(conv('RUNNING'), step('RUNNING', 'command'), connected, NOW)).toBe('working');
    expect(computeVisualState(conv('RUNNING'), null, connected, NOW)).toBe('working');
  });
  it('6. canceling or canceled → stopped', () => {
    expect(computeVisualState(conv('CANCELING'), step('DONE'), connected, NOW)).toBe('stopped');
    for (const s of ['CANCELED', 'INTERRUPTED', 'HALTED'] as const) {
      expect(computeVisualState(conv('IDLE'), step(s), connected, NOW)).toBe('stopped');
    }
  });
  it('7. IDLE → idle', () => {
    expect(computeVisualState(conv('IDLE'), step('DONE'), connected, NOW)).toBe('idle');
  });
  it('8. anything else → unknown', () => {
    expect(computeVisualState(conv('UNKNOWN'), step('DONE'), connected, NOW)).toBe('unknown');
  });
});

describe('stopped/error decay', () => {
  it('returns to idle after 10 minutes', () => {
    const old = new Date(NOW - STICKY_MS - 1000).toISOString();
    expect(computeVisualState(conv('IDLE'), step('ERROR', 'agent', old), connected, NOW)).toBe('idle');
    expect(computeVisualState(conv('IDLE'), step('CANCELED', 'agent', old), connected, NOW)).toBe('idle');
  });
  it('returns to idle when the boss sends a new message after the error', () => {
    const later = new Date(Date.parse('2026-11-06T10:00:00Z') + 5000).toISOString();
    expect(computeVisualState(conv('IDLE', later), step('ERROR'), connected, NOW)).toBe('idle');
  });
});
