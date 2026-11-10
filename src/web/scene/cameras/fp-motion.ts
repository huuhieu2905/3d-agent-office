import type { Cell } from '../grid/grid';

// Collision-aware movement for the first-person camera (FR-071, R15): a circle of radius 0.2 m slides
// along walls/furniture using the same cell grid as pathfinding. Pure so it can be unit-tested.
// 004 US4 (R4-07): the grid is the SiteGrid (office + park), so the user walks out of the door and around
// the park; employees (`others`) block the way too (FR-035).

export const EYE_HEIGHT = 1.65;
// Larger than half a nav cell (0.125 m): a cell centre next to furniture is not free — use nearestFree().
export const RADIUS = 0.2;
/** Keep this far (m) from an employee's centre. */
export const PERSON_GAP = RADIUS + 0.2;

export interface MotionGrid {
  toCell(x: number, z: number): Cell;
  walkable(x: number, z: number): boolean;
  canStep(a: Cell, b: Cell): boolean;
}

export type Others = Iterable<{ x: number; z: number }>;

/** Is a circle at (x, z) free of blocked cells, blocked edges and people? */
export function freeAt(grid: MotionGrid, x: number, z: number, r = RADIUS, others?: Others): boolean {
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
  if (others) for (const o of others) if (Math.hypot(o.x - x, o.z - z) < PERSON_GAP) return false;
  return true;
}

/** Move from (x, z) by (dx, dz), sliding along obstacles axis by axis. */
export function slide(grid: MotionGrid, x: number, z: number, dx: number, dz: number, others?: Others): { x: number; z: number } {
  // Someone already too close (they walked into us): only accept moves that do not get closer.
  const list = others ? [...others].filter((o) => Math.hypot(o.x - x, o.z - z) >= PERSON_GAP) : undefined;
  let nx = x;
  let nz = z;
  if (freeAt(grid, x + dx, z, RADIUS, list)) nx = x + dx;
  if (freeAt(grid, nx, z + dz, RADIUS, list)) nz = z + dz;
  return { x: nx, z: nz };
}

/** Nearest point within maxR of (x, z) where the body fits (freeAt), scanned on a 5 cm lattice; null if none. */
export function nearestFree(grid: MotionGrid, x: number, z: number, maxR = 1.5, ok: (x: number, z: number) => boolean = () => true): { x: number; z: number } | null {
  const step = 0.05;
  const n = Math.ceil(maxR / step);
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const d = Math.hypot(i, j) * step;
      if (d > maxR || d >= bestD) continue;
      const px = x + i * step;
      const pz = z + j * step;
      if (ok(px, pz) && freeAt(grid, px, pz)) {
        best = { x: px, z: pz };
        bestD = d;
      }
    }
  return best;
}
