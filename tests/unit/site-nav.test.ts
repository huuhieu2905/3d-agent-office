import { describe, expect, it } from 'vitest';
import type { DoorSide, OfficeLayout } from '../../src/shared/domain';
import { OfficeGrid } from '../../src/shared/nav-core';
import { SiteGrid } from '../../src/shared/site-nav';
import { defaultLayout } from '../../src/server/services/default-layout';
import { findPath } from '../../src/web/scene/grid/astar';

// 004 T024 (data-model §4, research R4-03): one grid for office + park.

function withDoor(side: DoorSide, offset: number): OfficeLayout {
  const l = defaultLayout();
  return { ...l, shell: { ...l.shell, door: { side, offset } } };
}

const RADIUS = 30;

describe('SiteGrid', () => {
  const layout = defaultLayout();
  const office = new OfficeGrid(layout);
  const site = new SiteGrid(office, { radius: RADIUS, boxes: [{ x: 0, z: -20, hw: 2, hd: 1.5, rot: 0.3 }], circles: [{ x: 15, z: 0, r: 0.35 }] });

  it('matches OfficeGrid on the floor, at the same world positions', () => {
    for (let z = 0; z < office.depth; z += 3)
      for (let x = 0; x < office.width; x += 3) {
        const s = { x: x + site.ox, z: z + site.oz };
        expect(site.walkable(s.x, s.z)).toBe(office.walkable(x, z));
        expect(site.toWorld(s)).toEqual(office.toWorld({ x, z }));
        expect(site.toCell(...([site.toWorld(s)[0], site.toWorld(s)[2]] as [number, number]))).toEqual(s);
        for (const n of office.neighbours({ x, z })) expect(site.canStep(s, { x: n.x + site.ox, z: n.z + site.oz })).toBe(true);
      }
    expect(site.entrance().door).toEqual({ x: office.entrance().door.x + site.ox, z: office.entrance().door.z + site.oz });
  });

  it('closes the floor edge except through the door, on every side', () => {
    for (const [side, offset] of [
      ['south', 3],
      ['east', 2],
      ['west', 4],
    ] as [DoorSide, number][]) {
      const s = new SiteGrid(new OfficeGrid(withDoor(side, offset)), { radius: RADIUS });
      const door = s.entrance().door;
      const out = side === 'south' ? { x: door.x, z: door.z + 1 } : side === 'east' ? { x: door.x + 1, z: door.z } : { x: door.x - 1, z: door.z };
      expect(s.canStep(door, out), `${side}: door → out`).toBe(true);
      expect(s.canStep(out, door), `${side}: out → door`).toBe(true);
      // A cell along the same wall, well away from the door, is closed.
      const along = side === 'south' ? { x: door.x + 12, z: door.z } : { x: door.x, z: door.z + (door.z > 20 ? -12 : 12) };
      const alongOut = side === 'south' ? { x: along.x, z: along.z + 1 } : side === 'east' ? { x: along.x + 1, z: along.z } : { x: along.x - 1, z: along.z };
      if (s.isIndoor(along.x, along.z) && s.walkable(along.x, along.z)) expect(s.canStep(along, alongOut), `${side}: wall`).toBe(false);
    }
  });

  it('outdoors: blocked beyond the park radius, by a (rotated) shop box and by a tree trunk', () => {
    expect(site.outdoorFree(RADIUS + 0.5, 0)).toBe(false);
    expect(site.outdoorFree(0, -20)).toBe(false);
    expect(site.outdoorFree(15, 0)).toBe(false);
    expect(site.outdoorFree(15, 1.2)).toBe(true);
    expect(site.outdoorFree(10, 10)).toBe(true);
  });

  it('indoor A* never leaves the floor', () => {
    const view = site.indoorView();
    const { door, lobby } = site.entrance();
    const desk = layout.items.find((i) => i.type === 'desk')!;
    const p = findPath(view, door, site.seatOf(desk.id)!)!;
    expect(p).not.toBeNull();
    expect(p.every((c) => site.isIndoor(c.x, c.z))).toBe(true);
    expect(view.neighbours(door).every((c) => site.isIndoor(c.x, c.z))).toBe(true);
    expect(lobby).toBeTruthy();
  });

  it('doorstep is 1.5 m out of the door and walkable', () => {
    const d = site.doorstep();
    expect(site.isIndoorAt(d.x, d.z)).toBe(false);
    const c = site.toCell(d.x, d.z);
    expect(site.walkable(c.x, c.z)).toBe(true);
  });

  it('setCircles replaces the round obstacles in place (detail / city change keeps the same grid, T062)', () => {
    const g = new SiteGrid(office, { radius: RADIUS, circles: [{ x: 15, z: 0, r: 0.35 }] });
    expect(g.outdoorFree(15, 0)).toBe(false);
    expect(g.outdoorFree(-15, 0)).toBe(true);
    g.setCircles([{ x: -15, z: 0, r: 0.35 }]);
    expect(g.outdoorFree(15, 0)).toBe(true);
    expect(g.outdoorFree(-15, 0)).toBe(false);
  });
});
