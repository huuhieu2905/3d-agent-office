import { describe, expect, it } from 'vitest';
import { OfficeGrid } from '../../src/shared/nav-core';
import { SiteGrid } from '../../src/shared/site-nav';
import { defaultLayout } from '../../src/server/services/default-layout';
import { Crowd, RADIUS_SEATED, RADIUS_WALKING } from '../../src/web/scene/crowd/crowd';
import { SpotBook } from '../../src/web/scene/break-spots';
import { EmployeeBrain } from '../../src/web/scene/employee-behaviors';
import { PARK_RADIUS } from '../../src/web/scene/park/detail';
import { parkFrame, parkShops, visibleTrees } from '../../src/web/scene/park/park-layout';

// 004 T066 / SC-004: 30 simulated minutes, 8 idle employees in the default office with the park shops,
// breaks every ~15 s. Nobody stands still > 5 s while walking, nobody overlaps, the outing cap holds, and
// every kind of break happens. Slow (~1–2 min), so opt-in: SOAK=1 npx vitest run tests/unit/soak.test.ts

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe.skipIf(!process.env.SOAK)('soak: 30 minutes of office life (SC-004)', () => {
  it.each([1, 2, 3])('seed %i', (seed) => {
    const layout = defaultLayout();
    const office = new OfficeGrid(layout);
    const frame = parkFrame(layout.floor);
    const shops = parkShops(frame);
    const trees = visibleTrees(frame, 1, 160).map((t) => ({ x: t.x, z: t.z, r: 0.35 }));
    const site = new SiteGrid(office, { radius: PARK_RADIUS - 1, boxes: shops.map((s) => s.box), circles: [...shops.flatMap((s) => s.tables), ...trees] });
    const crowd = new Crowd(site);
    const spots = new SpotBook();
    spots.setPopulation(8);
    const rng = mulberry(seed);
    const desks = layout.items.filter((i) => i.type === 'desk').slice(0, 8);
    const brains = desks.map((d, i) => {
      const b = new EmployeeBrain({ grid: site, seat: site.seatOf(d.id), crowd, spots, shops, frame, id: `e${i}`, rng, now: 0, breakMeanMs: 15_000, breakJitterMs: 7_500 });
      b.setVisual('idle', 0);
      return b;
    });
    const dt = 1 / 30;
    let now = 0;
    let longest = 0;
    let overlaps = 0;
    let maxOut = 0;
    const acts = new Set<string>();
    const still = new Map<string, { x: number; z: number; since: number }>();
    for (let s = 0; s < 30 * 60 * 30; s++) {
      now += dt * 1000;
      brains.forEach((b, i) => {
        b.tick(dt, now);
        if (b.activity) acts.add(b.activity);
        const moving = b.modeKind === 'walking' || b.modeKind === 'outing';
        const p = b.position;
        const prev = still.get(`e${i}`);
        if (moving && prev && Math.hypot(prev.x - p.x, prev.z - p.z) < 0.05) {
          longest = Math.max(longest, now - prev.since);
          if (process.env.SOAK_DEBUG && now - prev.since > 4500 && now - prev.since - dt * 1000 <= 4500) {
            const raw = b as unknown as { mode: { then?: string; i?: number; path?: unknown[]; pts?: unknown[] }; blockedFor: number };
            const near = crowd.all().filter((o) => o.id !== `e${i}` && Math.hypot(o.x - p.x, o.z - p.z) < 1.2).map((o) => `${o.id}${o.seated ? '(s)' : ''}@${o.x.toFixed(2)},${o.z.toFixed(2)}`);
            console.log(`STILL t=${(now / 1000).toFixed(1)} e${i} ${b.modeKind}/${raw.mode.then} i=${raw.mode.i}/${(raw.mode.path ?? raw.mode.pts)?.length} @${p.x.toFixed(2)},${p.z.toFixed(2)} outside=${b.outside} near=[${near.join(' ')}]`);
          }
        }
        else still.set(`e${i}`, { x: p.x, z: p.z, since: now });
        if (!moving) still.delete(`e${i}`);
      });
      maxOut = Math.max(maxOut, spots.outsideCount);
      const ag = crowd.all();
      for (let i = 0; i < ag.length; i++)
        for (let j = i + 1; j < ag.length; j++) {
          const a = ag[i]!;
          const c = ag[j]!;
          const min = (a.seated ? RADIUS_SEATED : RADIUS_WALKING) + (c.seated ? RADIUS_SEATED : RADIUS_WALKING);
          if (Math.hypot(a.x - c.x, a.z - c.z) < min - 0.01) {
            overlaps++;
            if (process.env.SOAK_DEBUG) {
              const ba = brains.find((b) => (b as unknown as { o: { id: string } }).o.id === a.id);
              const bc = brains.find((b) => (b as unknown as { o: { id: string } }).o.id === c.id);
              const m = (b?: EmployeeBrain) => (b ? `${b.modeKind}/${(b as unknown as { mode: { then?: string } }).mode.then ?? ''}/${b.activity}` : '?');
              console.log(`OVERLAP t=${(now / 1000).toFixed(1)} ${a.id}${a.seated ? '(s)' : ''} ${m(ba)} @${a.x.toFixed(2)},${a.z.toFixed(2)} vs ${c.id}${c.seated ? '(s)' : ''} ${m(bc)} @${c.x.toFixed(2)},${c.z.toFixed(2)} d=${Math.hypot(a.x - c.x, a.z - c.z).toFixed(3)} min=${min}`);
            }
          }
        }
    }
    expect(longest, 'longest standstill while walking (ms)').toBeLessThanOrEqual(5000);
    expect(overlaps, 'overlapping frame-pairs').toBe(0);
    expect(maxOut).toBeLessThanOrEqual(spots.outingSlots);
    expect([...acts].sort()).toEqual(['shop', 'sofa', 'stretch', 'water']);
  }, 600_000);
});
