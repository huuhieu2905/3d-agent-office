import type { OfficeGrid } from '../grid/grid';

// Collision-aware movement for the first-person camera (FR-071, R15): a circle of radius 0.2 m slides
// along walls/furniture using the same cell grid as pathfinding. Pure so it can be unit-tested.

export const EYE_HEIGHT = 1.65;
// Must stay below half a cell (0.25 m) so a body centred in a cell next to a wall is not "inside" it.
export const RADIUS = 0.2;

/** Is a circle at (x, z) free of blocked cells and blocked edges? */
export function freeAt(grid: OfficeGrid, x: number, z: number, r = RADIUS): boolean {
  const c = grid.toCell(x, z);
  if (!grid.walkable(c.x, c.z)) return false;
  // Check the four points of the circle; each must be in a walkable cell reachable from the centre cell.
  for (const [dx, dz] of [
    [r, 0],
    [-r, 0],
    [0, r],
    [0, -r],
  ] as const) {
    const n = grid.toCell(x + dx, z + dz);
    if (n.x === c.x && n.z === c.z) continue;
    if (!grid.canStep(c, n)) return false;
  }
  return true;
}

/** Move from (x, z) by (dx, dz), sliding along obstacles axis by axis. */
export function slide(grid: OfficeGrid, x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  let nx = x;
  let nz = z;
  if (freeAt(grid, x + dx, z)) nx = x + dx;
  if (freeAt(grid, nx, z + dz)) nz = z + dz;
  return { x: nx, z: nz };
}
