import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { BREAK_JITTER_MS, BREAK_MEAN_MS, EmployeeBrain } from '../../src/web/scene/employee-behaviors';

const layout = defaultLayout();
const grid = new OfficeGrid(layout);
const desk = layout.items.find((i) => i.type === 'desk')!;
const seat = grid.seatOf(desk.id)!;

function run(brain: EmployeeBrain, ms: number, start: number, step = 100) {
  let now = start;
  let pose = brain.tick(0, now);
  const modes = new Set<string>();
  for (let t = 0; t < ms; t += step) {
    now += step;
    pose = brain.tick(step / 1000, now);
    modes.add(brain.modeKind);
  }
  return { pose, now, modes };
}

describe('EmployeeBrain', () => {
  it('sits at its desk facing the desk', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.99, now: 0 });
    const p = b.tick(0, 0);
    const [x, , z] = grid.toWorld(seat);
    expect([p.x, p.z]).toEqual([x, z]);
    expect(p.seated).toBe(true);
    expect(p.clip).toBe('Sitting');
  });

  it('takes a break within 5 ± 2 minutes when idle and returns to the SAME desk', () => {
    let r = 0;
    const seq = [0.5, 0.1, 0.5, 0.5, 0.5];
    const b = new EmployeeBrain({ grid, seat, rng: () => seq[r++ % seq.length]!, now: 0 });
    b.setVisual('idle', 0);
    const { modes, now } = run(b, BREAK_MEAN_MS + BREAK_JITTER_MS + 60_000, 0, 200);
    expect(modes.has('walking') || modes.has('acting')).toBe(true);
    const end = run(b, 120_000, now, 200).pose;
    const [x, , z] = grid.toWorld(seat);
    expect(end.x).toBeCloseTo(x, 5);
    expect(end.z).toBeCloseTo(z, 5);
  });

  it('cuts a break short and goes back to work when the agent starts running', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.1, now: 0 });
    b.setVisual('idle', 0);
    const r1 = run(b, BREAK_MEAN_MS + BREAK_JITTER_MS, 0, 500);
    b.setVisual('working', r1.now);
    const r2 = run(b, 60_000, r1.now, 100);
    expect(b.modeKind).toBe('seated');
    expect(r2.pose.seated).toBe(true);
  });

  it('new employees walk in from the door; removed employees walk out and finish', () => {
    const b = new EmployeeBrain({ grid, seat, enter: true, rng: () => 0.9, now: 0 });
    expect(b.modeKind).toBe('entering');
    run(b, 60_000, 0, 100);
    expect(b.modeKind).toBe('seated');
    b.leave(60_000);
    run(b, 60_000, 60_000, 100);
    expect(b.done).toBe(true);
  });

  it('freezes while disconnected', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.9, now: 0 });
    b.setVisual('disconnected', 0);
    expect(b.tick(0.1, 10_000).clip).toBe('Idle');
  });
});

// ---- 004 T028: breaks on the sofa and at the park shops (data-model §7, R4-05/06/09) -----------------

import type { OfficeLayout } from '../../src/shared/domain';
import { SiteGrid } from '../../src/shared/site-nav';
import { Crowd } from '../../src/web/scene/crowd/crowd';
import { SpotBook } from '../../src/web/scene/break-spots';
import { PARK_RADIUS } from '../../src/web/scene/park/detail';
import { parkFrame, parkShops, visibleTrees } from '../../src/web/scene/park/park-layout';

function world(l: OfficeLayout, opts: { sofa?: boolean; cooler?: boolean } = {}) {
  const items = l.items.filter((i) => (opts.sofa || i.type !== 'sofa') && (opts.cooler || i.type !== 'water_cooler'));
  const layout = { ...l, items };
  const office = new OfficeGrid(layout);
  const frame = parkFrame(layout.floor);
  const shops = parkShops(frame);
  const trees = visibleTrees(frame, 1, 160);
  const site = new SiteGrid(office, {
    radius: PARK_RADIUS - 1,
    boxes: shops.map((s) => s.box),
    circles: [...shops.flatMap((s) => s.tables), ...trees.map((t) => ({ x: t.x, z: t.z, r: 0.35 }))],
  });
  const crowd = new Crowd(site);
  const spots = new SpotBook();
  spots.setPopulation(3);
  const d = layout.items.find((i) => i.type === 'desk')!;
  return { layout, site, crowd, spots, shops, frame, seat: site.seatOf(d.id)! };
}

function brainIn(w: ReturnType<typeof world>, rng: () => number) {
  const b = new EmployeeBrain({ grid: w.site, seat: w.seat, crowd: w.crowd, spots: w.spots, shops: w.shops, frame: w.frame, id: 'e1', rng, now: 0, breakMeanMs: 1000, breakJitterMs: 0 });
  b.setVisual('idle', 0);
  return b;
}

/** Tick until `until` is true (or the time runs out); returns the clock. Checks every position is walkable. */
function runUntil(w: ReturnType<typeof world>, b: EmployeeBrain, start: number, maxMs: number, until: () => boolean, step = 50) {
  let now = start;
  const modes: string[] = [];
  for (let t = 0; t < maxMs && !until(); t += step) {
    now += step;
    const p = b.tick(step / 1000, now);
    if (modes.at(-1) !== b.modeKind) modes.push(b.modeKind);
    if (b.modeKind !== 'resting') {
      const c = w.site.toCell(p.x, p.z);
      expect(w.site.walkable(c.x, c.z), `${b.modeKind} at ${p.x.toFixed(2)},${p.z.toFixed(2)}`).toBe(true);
    }
  }
  return { now, modes };
}

describe('EmployeeBrain 004: sofa and shop breaks', () => {
  // No cooler, no sofa: the options are stretch (0.15) and shop (0.30); rng 0.9 picks the shop.
  it('goes out of the door to a shop, rests, comes back to the SAME desk', () => {
    const w = world(defaultLayout());
    const b = brainIn(w, () => 0.9);
    const out = runUntil(w, b, 0, 120_000, () => b.modeKind === 'resting');
    expect(b.activity).toBe('shop');
    expect(b.outside).toBe(true);
    expect(out.modes).toEqual(expect.arrayContaining(['walking', 'outing', 'resting']));
    expect(w.spots.outsideCount).toBe(1);
    const back = runUntil(w, b, out.now, 200_000, () => b.modeKind === 'seated');
    expect(back.modes).toEqual(expect.arrayContaining(['outing', 'walking', 'seated']));
    // Checked before ticking again: with a 1 s break interval the next tick may start a new break.
    expect(w.spots.outsideCount).toBe(0);
    expect(b.activity).toBeNull();
    const [x, , z] = w.site.toWorld(w.seat);
    expect([b.position.x, b.position.z]).toEqual([x, z]);
  });

  it('work arriving at the shop: back at the desk within 30 s, running', () => {
    const w = world(defaultLayout());
    const b = brainIn(w, () => 0.9);
    const out = runUntil(w, b, 0, 120_000, () => b.modeKind === 'resting');
    b.setVisual('working', out.now);
    expect(b.tick(0.05, out.now + 50).speedScale).toBeGreaterThan(2);
    const back = runUntil(w, b, out.now, 30_000, () => b.modeKind === 'seated');
    expect(b.modeKind).toBe('seated');
    expect(back.now - out.now).toBeLessThanOrEqual(30_000);
  });

  it('rain: never chooses the shop; rain while outside → umbrella, back inside, umbrella away', () => {
    const w = world(defaultLayout());
    const dry = brainIn(w, () => 0.9);
    const out = runUntil(w, dry, 0, 120_000, () => dry.modeKind === 'resting');
    dry.setWeather('rain', out.now);
    expect(dry.tick(0.05, out.now + 50).umbrella).toBe(true);
    runUntil(w, dry, out.now, 60_000, () => !dry.outside);
    expect(dry.tick(0.05, out.now + 60_050).umbrella).toBe(false);
    runUntil(w, dry, out.now + 60_100, 60_000, () => dry.modeKind === 'seated');
    expect(dry.modeKind).toBe('seated');

    const w2 = world(defaultLayout());
    const wet = brainIn(w2, () => 0.9);
    wet.setWeather('storm', 0);
    let now = 0;
    for (let i = 0; i < 400; i++) {
      now += 100;
      wet.tick(0.1, now);
      expect(wet.activity).not.toBe('shop');
    }
  });

  it('sofa: lies down (both seats booked), recall gets up and sits back at the desk', () => {
    const w = world(defaultLayout(), { sofa: true });
    expect(w.layout.items.some((i) => i.type === 'sofa')).toBe(true);
    // Options stretch .15, sofa .25, shop .30 → rng 0.3 → 0.3·0.7 = 0.21 → sofa; then 0.3 < 0.4 → lie.
    const b = brainIn(w, () => 0.3);
    const r = runUntil(w, b, 0, 120_000, () => b.modeKind === 'resting');
    expect(b.activity).toBe('sofa');
    expect(b.tick(0.05, r.now + 50).clip).toBe('Lying');
    expect(w.spots.spotsOf('e1')).toHaveLength(2);
    b.recall({}, r.now + 100);
    runUntil(w, b, r.now + 100, 60_000, () => b.modeKind === 'seated');
    expect(b.modeKind).toBe('seated');
    expect(w.spots.spotsOf('e1')).toHaveLength(0);
  });

  it('disconnected while outside: walks back to the desk, then stands still', () => {
    const w = world(defaultLayout());
    const b = brainIn(w, () => 0.9);
    const out = runUntil(w, b, 0, 120_000, () => b.modeKind === 'resting');
    b.setVisual('disconnected', out.now);
    runUntil(w, b, out.now, 120_000, () => b.modeKind === 'seated');
    expect(b.modeKind).toBe('seated');
  });

  it('deleted while outside: walks off to the park edge and finishes', () => {
    const w = world(defaultLayout());
    const b = brainIn(w, () => 0.9);
    const out = runUntil(w, b, 0, 120_000, () => b.modeKind === 'resting');
    b.leave(out.now);
    runUntil(w, b, out.now, 200_000, () => b.done);
    expect(b.done).toBe(true);
    expect(w.spots.outsideCount).toBe(0);
  });
});
