import type { ConnectionState, Conversation, Step, VisualState } from '../../shared/domain';

// data-model.md §6 — evaluated top to bottom, first match wins.

export const STICKY_MS = 10 * 60_000;

function decayed(lastStep: Step, conversation: Conversation, now: number): boolean {
  const at = lastStep.createdAt ? Date.parse(lastStep.createdAt) : NaN;
  if (Number.isFinite(at) && now - at > STICKY_MS) return true;
  const input = conversation.lastUserInputAt ? Date.parse(conversation.lastUserInputAt) : NaN;
  return Number.isFinite(at) && Number.isFinite(input) && input > at;
}

export function computeVisualState(
  conversation: Conversation,
  lastStep: Step | null,
  connection: ConnectionState,
  now: number = Date.now(),
): VisualState {
  const run = conversation.runStatus;
  const running = run === 'RUNNING' || run === 'BUSY';

  if (connection.kind !== 'connected') return 'disconnected';
  if (lastStep && (lastStep.status === 'WAITING' || (lastStep.kind === 'permission_request' && lastStep.status !== 'DONE'))) {
    return 'waiting_for_boss';
  }
  if (lastStep && lastStep.status === 'ERROR' && run === 'IDLE') {
    return decayed(lastStep, conversation, now) ? 'idle' : 'error';
  }
  if (running && lastStep?.status === 'GENERATING') return 'thinking';
  if (running) return 'working';
  if (run === 'CANCELING') return 'stopped';
  if (lastStep && ['CANCELED', 'INTERRUPTED', 'HALTED'].includes(lastStep.status)) {
    if (run === 'IDLE' && decayed(lastStep, conversation, now)) return 'idle';
    return 'stopped';
  }
  if (run === 'IDLE') return 'idle';
  return 'unknown';
}
