import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { findPath } from '../../src/web/scene/grid/astar';

describe('office grid + A*', () => {
  const layout = defaultLayout();
  const grid = new OfficeGrid(layout);

  it('every default desk seat is reachable from the door lobby', () => {
    const { lobby } = grid.entrance();
    for (const desk of layout.items.filter((i) => i.type === 'desk')) {
      const seat = grid.seatOf(desk.id)!;
      expect(grid.walkable(seat.x, seat.z)).toBe(true);
      expect(findPath(grid, lobby, seat), desk.id).not.toBeNull();
    }
  });

  it('the water cooler is reachable', () => {
    const spot = grid.approachOf('water_cooler')!;
    expect(spot).not.toBeNull();
    expect(findPath(grid, grid.entrance().lobby, spot)).not.toBeNull();
  });

  it('desks block cells and walls block edges', () => {
    const desk = layout.items.find((i) => i.type === 'desk')!;
    expect(grid.walkable(desk.cell.x, desk.cell.z)).toBe(false);
    // South wall at z = 23 except the door: cannot step from row 22 to 23 at x = 5.
    expect(grid.canStep({ x: 5, z: 22 }, { x: 5, z: 23 })).toBe(false);
    expect(grid.canStep({ x: 14, z: 22 }, { x: 14, z: 23 })).toBe(true);
  });

  it('world/cell conversion round-trips', () => {
    const c = { x: 7, z: 11 };
    const [x, , z] = grid.toWorld(c);
    expect(grid.toCell(x, z)).toEqual(c);
  });
});
