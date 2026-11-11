import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Conversation } from '../../src/shared/domain';
import { EmployeeProfiles } from '../../src/server/services/employee-profiles';
import { EmployeesService, OfficeFullError, PENDING_POLLS } from '../../src/server/services/employees';
import { LayoutStore } from '../../src/server/services/layout-store';
import { defaultLayout, desks } from '../../src/server/services/default-layout';

// 009 T006: office membership — visible rule (FR-008/FR-018), seed (FR-017), limit + lock (FR-009), desks, restart.

const dirs: string[] = [];
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop()!, { recursive: true, force: true });
});

const clock = Date.parse('2026-11-11T00:00:00Z');
function conv(id: string, minutesAgo: number, parentId: string | null = null): Conversation {
  return {
    id,
    title: id,
    projectId: 'p',
    parentId,
    runStatus: 'IDLE',
    stepCount: 1,
    lastActivityAt: new Date(clock - minutesAgo * 60_000).toISOString(),
    lastUserInputAt: null,
    workspaceUris: [],
    currentModel: null,
  };
}
const top = (n: number, prefix = 'c') => Array.from({ length: n }, (_, i) => conv(`${prefix}${i}`, i));

async function setup(initial: Conversation[], dir?: string) {
  const dataDir = dir ?? (await mkdtemp(join(tmpdir(), 'ao-members-')));
  if (!dir) dirs.push(dataDir);
  const state = { list: initial };
  const adapter = {
    getConnection: () => ({ kind: 'connected', appVersion: 'x', versionSupported: true, verifiedVersions: [] }),
    listConversations: async () => state.list,
    getSteps: async () => [],
    onConnectionChange: () => () => undefined,
  };
  const profiles = new EmployeeProfiles(dataDir);
  const svc = new EmployeesService({
    adapter: adapter as never,
    hub: { broadcast: () => undefined, onClientConnect: () => undefined } as never,
    log: { warn: () => undefined } as never,
    profiles,
    layout: new LayoutStore(dataDir),
    now: () => clock,
  });
  await svc.refresh();
  const visible = () => svc.snapshot().employees.filter((e) => e.visible).map((e) => e.conversationId).sort();
  return { svc, profiles, state, visible, dataDir };
}

describe('009 office membership', () => {
  it('seeds once from the old rule: top-level conversations among the 20 most recent', async () => {
    const list = [...top(22), conv('sub', 0, 'c0')];
    const t = await setup(list);
    expect(await t.svc.memberCount()).toBe(19); // 20 most recent = c0..c18 + sub; sub is not a member
    expect(await t.profiles.membersSeeded()).toBe(true);
    // A conversation arriving later is not a member, and the seed does not run again.
    t.state.list = [...list, conv('late', 0)];
    await t.svc.refresh();
    expect(t.visible()).not.toContain('late');
  });

  it('does not seed on an empty list (App hiccup)', async () => {
    const t = await setup([]);
    expect(await t.profiles.membersSeeded()).toBe(false);
    t.state.list = top(3);
    await t.svc.refresh();
    expect(t.visible()).toEqual(['c0', 'c1', 'c2']);
  });

  it('shows members however old, never non-members; subagents follow their member root', async () => {
    const t = await setup(top(2));
    t.state.list = [...top(2), conv('old', 100_000), conv('child', 0, 'c1'), conv('grand', 0, 'child'), conv('orphanSub', 0, 'old')];
    await t.svc.refresh();
    expect(t.visible()).toEqual(['c0', 'c1', 'child', 'grand']);
    await t.svc.admit(async () => ({ conversationId: 'old' }), { existingId: 'old' });
    expect(t.visible()).toEqual(['c0', 'c1', 'child', 'grand', 'old', 'orphanSub']);
    expect(await t.svc.memberCount()).toBe(3);
  });

  it('FR-018: at most 20 shown; least recently active subagents are hidden, members never', async () => {
    const t = await setup(top(18));
    const subs = [0, 1, 2, 3, 4].map((i) => conv(`s${i}`, i * 10, 'c0'));
    t.state.list = [...top(18), ...subs];
    await t.svc.refresh();
    const v = t.visible();
    expect(v).toHaveLength(20);
    for (let i = 0; i < 18; i++) expect(v).toContain(`c${i}`);
    expect(v).toEqual(expect.arrayContaining(['s0', 's1']));
    expect(v).not.toContain('s4');
  });

  it('when full, the idle member inactive the longest leaves; concurrent hires each send out a different one', async () => {
    const t = await setup(top(20));
    t.state.list = [...top(20), conv('x', 0), conv('y', 0)];
    await t.svc.refresh();
    const [rx, ry] = await Promise.all([
      t.svc.admit(async () => ({ conversationId: 'x' }), { existingId: 'x' }),
      t.svc.admit(async () => ({ conversationId: 'y' }), { existingId: 'y' }),
    ]);
    expect([rx.evicted?.conversationId, ry.evicted?.conversationId]).toEqual(['c19', 'c18']);
    expect(rx.evicted?.title).toBe('c19');
    expect(await t.svc.memberCount()).toBe(20);
    expect(t.visible()).toEqual(expect.arrayContaining(['x', 'y']));
    expect(t.visible()).not.toContain('c19');
    // The one who left can be hired back (and someone else makes room).
    await expect(t.svc.admit(async () => ({ conversationId: 'c19' }), { existingId: 'c19' })).resolves.toMatchObject({ evicted: { conversationId: 'c17' } });
    // An existing member does not need a place.
    await expect(t.svc.admit(async () => ({ conversationId: 'c0' }), { existingId: 'c0' })).resolves.toMatchObject({ alreadyMember: true, evicted: null });
  });

  it('never sends out a busy member; refuses only when all 20 are busy', async () => {
    const busy = (n: number) => top(n).map((c) => ({ ...c, runStatus: 'RUNNING' as const }));
    const t = await setup([...busy(19), conv('idle', 1)]);
    t.state.list = [...busy(19), conv('idle', 1), conv('x', 0)];
    await t.svc.refresh();
    await expect(t.svc.admit(async () => ({ conversationId: 'x' }), { existingId: 'x' })).resolves.toMatchObject({ evicted: { conversationId: 'idle' } });
    t.state.list = [...busy(19), conv('idle', 1), { ...conv('x', 0), runStatus: 'RUNNING' }, conv('z', 0)];
    await t.svc.refresh();
    await t.svc.refresh(); // a new state is published after two polls (anti-flicker)
    let ran = false;
    await expect(t.svc.admit(async () => ((ran = true), { conversationId: 'z' }), { existingId: 'z' })).rejects.toBeInstanceOf(OfficeFullError);
    expect(ran).toBe(false);
  });

  it('counts a hire the App has not listed yet, and releases it after PENDING_POLLS polls', async () => {
    const t = await setup(top(19));
    await t.svc.admit(async () => ({ conversationId: 'ghost' }));
    // Full (19 listed + 1 pending): the next hire makes room by sending out the oldest listed member.
    await expect(t.svc.admit(async () => ({ conversationId: 'other' }))).resolves.toMatchObject({ evicted: { conversationId: 'c18' } });
    for (let i = 0; i < PENDING_POLLS; i++) await t.svc.refresh();
    expect(await t.svc.memberCount()).toBe(18); // c0..c17; ghost and other were never listed
    // Listed late: no longer a member (no silent 21st).
    t.state.list = [...top(19), conv('ghost', 0)];
    await t.svc.refresh();
    expect(t.visible()).not.toContain('ghost');
    await expect(t.svc.admit(async () => ({ conversationId: 'other2' }))).resolves.toMatchObject({ alreadyMember: false, evicted: null });
  });

  it('takes the chosen desk only when it is free; never moves whoever sits there', async () => {
    const t = await setup(top(2));
    const held = (await t.profiles.get('c0')).deskId!;
    t.state.list = [...top(2), conv('a', 0), conv('b', 0)];
    await t.svc.refresh();
    await t.svc.admit(async () => ({ conversationId: 'a' }), { existingId: 'a', deskId: held });
    expect((await t.profiles.get('c0')).deskId).toBe(held);
    expect((await t.profiles.get('a')).deskId).not.toBe(held);
    const taken = new Set((await t.profiles.assignedDesks()).keys());
    const free = desks(defaultLayout()).map((d) => d.id).filter((id) => !taken.has(id)).at(-1)!;
    await t.svc.admit(async () => ({ conversationId: 'b' }), { existingId: 'b', deskId: free });
    expect((await t.profiles.get('b')).deskId).toBe(free);
  });

  it('leaving frees the place, desk and seat; membership survives a restart (FR-016)', async () => {
    const t = await setup(top(3));
    const again = new EmployeeProfiles(t.dataDir);
    expect(await again.isMember('c1')).toBe(true);
    expect(await again.membersSeeded()).toBe(true);
    expect((await again.get('c1')).deskId).toBe((await t.profiles.get('c1')).deskId);
    await t.profiles.setMember('c1', false);
    await t.svc.refresh();
    expect(t.visible()).toEqual(['c0', 'c2']);
    expect((await t.profiles.get('c1')).deskId).toBeNull();
  });
});
