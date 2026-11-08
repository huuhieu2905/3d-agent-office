import { describe, expect, it } from 'vitest';
import type { OfficeLayout, PlacedItem } from '../../src/shared/domain';
import { OfficeGrid } from '../../src/shared/nav-core';
import { Crowd, RADIUS_SEATED, RADIUS_WALKING } from '../../src/web/scene/crowd/crowd';
import { EmployeeBrain } from '../../src/web/scene/employee-behaviors';

// 002 T040 — a cramped office, many employees taking frequent breaks for 10 simulated minutes.
// Invariants (FR-016..021, SC-005/006): nobody ever overlaps anybody, nobody stands in a blocked cell,
// seated employees never move, bumps happen and produce reactions, and nobody ends up stuck.

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function crampedOffice(): OfficeLayout {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (type: PlacedItem['type'], x: number, z: number) => items.push({ id: `${type}-${++n}`, type, pos: { x, z }, rotation: 0 });
  for (const z of [1, 4])
    for (const x of [0.5, 3, 5.5]) {
      add('desk', x, z);
      add('chair', x + 0.5, z + 1);
    }
  add('water_cooler', 9.25, 7.25);
  add('sofa', 8, 0.25);
  return { schemaVersion: 2, floor: { width: 10, depth: 8 }, shell: { glassSide: 'north', door: { side: 'south', offset: 4.5 } }, items };
}

describe('crowd: 10 minutes in a cramped office', () => {
  it.each([42, 7, 1234, 99])('seed %i: never overlaps, never enters blocked cells, keeps seated people still, bumps, and nobody gets stuck', (seed) => {
    const layout = crampedOffice();
    const grid = new OfficeGrid(layout);
    const crowd = new Crowd(grid);
    const rng = mulberry(seed);
    const desks = layout.items.filter((i) => i.type === 'desk');
    let now = 0;
    const brains: EmployeeBrain[] = [];
    // Six seated employees with breaks every ~20 s, two newcomers without a desk walking in to the lobby.
    desks.forEach((d, i) => {
      const b = new EmployeeBrain({ grid, seat: grid.seatOf(d.id), crowd, id: `e${i}`, rng, now, breakMeanMs: 20_000, breakJitterMs: 10_000 });
      b.setVisual('idle', now);
      brains.push(b);
    });
    for (let i = 0; i < 2; i++) {
      const b = new EmployeeBrain({ grid, seat: null, enter: true, lobbySlot: i, crowd, id: `new${i}`, rng, now: 0 });
      brains.push(b);
    }

    const dt = 1 / 60;
    const steps = 10 * 60 * 60;
    let bumps = 0;
    let reactions = 0;
    let minGap = Infinity;
    const seatedAt = new Map<string, string>();
    for (let s = 0; s < steps; s++) {
      now += dt * 1000;
      // At 9 minutes everyone gets real work: all six must make it back to their desks (liveness).
      if (s === 9 * 60 * 60) brains.slice(0, 6).forEach((b) => b.setVisual('working', now));
      for (const b of brains) {
        const p = b.tick(dt, now);
        if (p.reaction) reactions++;
      }
      const agents = crowd.all();
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i]!;
        const c = grid.toCell(a.x, a.z);
        expect(grid.walkable(c.x, c.z), `${a.id} in a blocked cell at step ${s}`).toBe(true);
        if (a.seated) {
          const key = `${a.x.toFixed(4)},${a.z.toFixed(4)}`;
          const prev = seatedAt.get(a.id);
          if (prev && prev.startsWith('S:')) expect(key, `${a.id} moved while seated`).toBe(prev.slice(2));
          seatedAt.set(a.id, `S:${key}`);
        } else seatedAt.delete(a.id);
        for (let j = i + 1; j < agents.length; j++) {
          const b = agents[j]!;
          const ra = a.seated ? RADIUS_SEATED : RADIUS_WALKING;
          const rb = b.seated ? RADIUS_SEATED : RADIUS_WALKING;
          const gap = Math.hypot(a.x - b.x, a.z - b.z) - (ra + rb);
          minGap = Math.min(minGap, gap);
          expect(gap, `${a.id}/${b.id} overlap at step ${s}`).toBeGreaterThanOrEqual(-0.01);
        }
      }
      for (const a of agents) if (a.events.length) bumps += a.events.length;
    }
    expect(minGap).toBeGreaterThanOrEqual(-0.01);
    expect(reactions, 'bumps should show reactions').toBeGreaterThan(0);
    expect(bumps + reactions).toBeGreaterThan(0);
    for (const b of brains.slice(0, 6)) expect(b.modeKind, 'back at the desk after real work started').toBe('seated');
  }, 60_000);

  it('a lower-priority walker gives way to a higher-priority one coming towards it', () => {
    const layout: OfficeLayout = { schemaVersion: 2, floor: { width: 8, depth: 6 }, shell: { glassSide: 'north', door: { side: 'south', offset: 3 } }, items: [] };
    const grid = new OfficeGrid(layout);
    const crowd = new Crowd(grid);
    crowd.place('low', 0, 0, { priority: 1 });
    crowd.place('high', 0.8, 0, { priority: 2 });
    const r = crowd.step('low', 3, 0, 0.05, 1 / 60, 0);
    expect(r.yielded).toBe(true);
    const h = crowd.step('high', -3, 0, 0.05, 1 / 60, 0);
    expect(h.yielded).toBe(false);
  });

  it('a seated employee is never pushed: a walker stops or goes around instead', () => {
    const layout: OfficeLayout = { schemaVersion: 2, floor: { width: 8, depth: 6 }, shell: { glassSide: 'north', door: { side: 'south', offset: 3 } }, items: [] };
    const grid = new OfficeGrid(layout);
    const crowd = new Crowd(grid);
    crowd.place('sit', 0, 0, { seated: true });
    crowd.place('walk', -1, 0, {});
    for (let i = 0; i < 120; i++) crowd.step('walk', 1, 0, 1.1 / 60, 1 / 60, i * 16);
    const s = crowd.get('sit')!;
    const w = crowd.get('walk')!;
    expect([s.x, s.z]).toEqual([0, 0]);
    expect(Math.hypot(w.x - s.x, w.z - s.z)).toBeGreaterThanOrEqual(RADIUS_SEATED + RADIUS_WALKING - 1e-9);
  });
});
