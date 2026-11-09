import { describe, expect, it } from 'vitest';
import type { OfficeLayout } from '../../src/shared/domain';
import { OfficeGrid } from '../../src/shared/nav-core';
import { SiteGrid } from '../../src/shared/site-nav';
import { defaultLayout } from '../../src/server/services/default-layout';
import { edgeExit, outdoorRoute, routeLength } from '../../src/web/scene/outdoor-route';
import { PARK_RADIUS } from '../../src/web/scene/park/detail';
import { parkFrame, parkShops, visibleTrees } from '../../src/web/scene/park/park-layout';
import { MAX_SHOP_ROUTE } from '../../src/web/scene/employee-behaviors';

// 004 T026 (R4-03, R4-06): routes out of the door to the shops, all on walkable ground.

function site(layout: OfficeLayout) {
  const f = parkFrame(layout.floor);
  const shops = parkShops(f);
  const trees = visibleTrees(f, 1, 320);
  const s = new SiteGrid(new OfficeGrid(layout), {
    radius: PARK_RADIUS - 1,
    boxes: shops.map((x) => x.box),
    circles: [...shops.flatMap((x) => x.tables), ...trees.map((t) => ({ x: t.x, z: t.z, r: 0.35 }))],
  });
  return { f, shops, s };
}

function sample(pts: { x: number; z: number }[], step = 0.25) {
  const out: { x: number; z: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
}

describe('outdoorRoute', () => {
  it('goes from the doorstep to every shop spot over walkable ground (except the last metre at the stool)', () => {
    const { f, shops, s } = site(defaultLayout());
    const from = s.doorstep();
    for (const shop of shops) {
      for (const spot of [...shop.seats, ...shop.stands]) {
        const r = outdoorRoute(f, from, spot);
        expect(r[0]).toEqual(from);
        expect(r.at(-1)).toEqual(spot);
        const pts = sample(r.slice(0, -2));
        for (const p of pts) expect(s.outdoorFree(p.x, p.z), `${spot.id} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
        expect(pts.every((p) => !s.isIndoorAt(p.x, p.z))).toBe(true);
      }
    }
  });

  it('takes the shorter way round and measures its length', () => {
    const { f, shops, s } = site(defaultLayout());
    const from = s.doorstep();
    for (const shop of shops) {
      const r = outdoorRoute(f, from, shop.stands[0]!);
      const straight = Math.hypot(shop.x - from.x, shop.z - from.z);
      expect(routeLength(r)).toBeLessThan(straight * 2.2);
    }
    expect(routeLength([{ x: 0, z: 0 }, { x: 3, z: 4 }])).toBeCloseTo(5, 6);
  });

  it('a 40 × 40 m office still has a shop within MAX_SHOP_ROUTE', () => {
    const l = defaultLayout();
    const big = { ...l, floor: { width: 40, depth: 40 } };
    const { f, shops, s } = site(big);
    const lengths = shops.map((x) => routeLength(outdoorRoute(f, s.doorstep(), x.stands[0]!)));
    expect(Math.min(...lengths)).toBeLessThanOrEqual(MAX_SHOP_ROUTE);
  });

  it('edgeExit ends just inside the park edge on a spoke', () => {
    const { f, s } = site(defaultLayout());
    const r = edgeExit(f, s.doorstep());
    const end = r.at(-1)!;
    expect(Math.hypot(end.x, end.z)).toBeCloseTo(PARK_RADIUS - 1.5, 6);
    expect(Math.min(Math.abs(end.x), Math.abs(end.z))).toBeLessThan(1e-9);
  });
});
