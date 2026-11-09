import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { freeAt, slide } from '../../src/web/scene/cameras/fp-motion';

const layout = defaultLayout();
const grid = new OfficeGrid(layout);

describe('first-person collision (FR-071)', () => {
  it('cannot walk into a desk', () => {
    const desk = layout.items.find((i) => i.type === 'desk')!;
    const [x, , z] = grid.toWorld(grid.floorToCell(desk.pos.x + 0.75, desk.pos.z + 0.5));
    expect(freeAt(grid, x, z)).toBe(false);
  });

  it('cannot walk out through the south side except at the door', () => {
    const [x0, , z0] = grid.toWorld(grid.floorToCell(2.6, 11.4));
    let p = { x: x0, z: z0 };
    for (let i = 0; i < 40; i++) p = slide(grid, p.x, p.z, 0, 0.1);
    expect(p.z).toBeLessThan(layout.floor.depth / 2);
  });

  it('slides along the side instead of stopping', () => {
    const [x0, , z0] = grid.toWorld(grid.floorToCell(2.6, 11.6));
    const p = slide(grid, x0, z0, 0.2, 0.2);
    expect(p.x).toBeGreaterThan(x0);
    expect(p.z).toBeLessThan(layout.floor.depth / 2);
  });
});

// ---- 004 T043: first person in the park (SiteGrid, FR-034/035) -------------------------------------

import { SiteGrid } from '../../src/shared/site-nav';

describe('first person with the SiteGrid (004)', () => {
  const site = new SiteGrid(grid, { radius: 30, boxes: [{ x: 0, z: 14, hw: 2, hd: 1.5, rot: 0 }], circles: [{ x: -6, z: 12, r: 0.35 }] });
  const { lobby } = site.entrance();

  it('walks out through the door into the park', () => {
    let [x, , z] = site.toWorld(lobby);
    for (let i = 0; i < 60; i++) ({ x, z } = slide(site, x, z, 0, 0.1));
    expect(site.isIndoorAt(x, z)).toBe(false);
    expect(z).toBeGreaterThan(layout.floor.depth / 2 + 2);
  });

  it('still cannot cross a wall or the glass anywhere else', () => {
    const [x0, , z0] = site.toWorld(site.toCell(2.6 - layout.floor.width / 2, 11.4 - layout.floor.depth / 2));
    let p = { x: x0, z: z0 };
    for (let i = 0; i < 40; i++) p = slide(site, p.x, p.z, 0, 0.1);
    expect(p.z).toBeLessThan(layout.floor.depth / 2);
    const [nx, , nz] = site.toWorld(site.toCell(0, -layout.floor.depth / 2 + 0.3));
    let q = { x: nx, z: nz };
    for (let i = 0; i < 40; i++) q = slide(site, q.x, q.z, 0, -0.1);
    expect(q.z).toBeGreaterThan(-layout.floor.depth / 2);
  });

  it('is stopped by the park edge, a shop and a tree trunk', () => {
    let p = { x: 0, z: 25 };
    for (let i = 0; i < 100; i++) p = slide(site, p.x, p.z, 0, 0.1);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(30);
    expect(freeAt(site, 0, 14)).toBe(false);
    expect(freeAt(site, -6, 12)).toBe(false);
    expect(freeAt(site, -6, 13.5)).toBe(true);
  });

  it('employees block the way', () => {
    expect(freeAt(site, 0, 20, undefined, [{ x: 0.2, z: 20 }])).toBe(false);
    expect(freeAt(site, 0, 20, undefined, [{ x: 1, z: 20 }])).toBe(true);
    const p = slide(site, 0, 20, 0.5, 0, [{ x: 0.7, z: 20 }]);
    expect(p.x).toBe(0);
  });
});
