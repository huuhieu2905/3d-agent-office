import { describe, expect, it } from 'vitest';
import { pickLeaver, type LeaverCandidate } from '../../src/shared/office';

// 009 T033 / research R8.

const m = (id: string, last: string, visualState = 'idle', memberSince: string | null = '2026-01-01T00:00:00Z'): LeaverCandidate => ({
  id,
  lastActivityAt: `2026-11-${last}T00:00:00Z`,
  memberSince,
  visualState,
});

describe('pickLeaver', () => {
  it('picks the member inactive the longest', () => {
    expect(pickLeaver([m('a', '10'), m('b', '02'), m('c', '05')])).toBe('b');
  });

  it('never picks a busy member (working, thinking, waiting for the boss)', () => {
    expect(pickLeaver([m('a', '01', 'working'), m('b', '02', 'thinking'), m('c', '03', 'waiting_for_boss'), m('d', '09')])).toBe('d');
  });

  it('breaks ties by who joined the office first', () => {
    expect(pickLeaver([m('a', '02', 'idle', '2026-05-01T00:00:00Z'), m('b', '02', 'idle', '2026-03-01T00:00:00Z')])).toBe('b');
  });

  it('returns null when everyone is busy or there is nobody', () => {
    expect(pickLeaver([m('a', '01', 'working')])).toBeNull();
    expect(pickLeaver([])).toBeNull();
  });
});
