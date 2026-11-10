import type { PlacedItem } from './domain';
import { DOOR_WIDTH } from './domain';
import { type Cell, NAV_CELL, OfficeGrid } from './nav-core';

// 004 US3/US4 (research R4-03, data-model §4): one navigation grid for the office AND the park around it,
// with the same interface as OfficeGrid so Crowd, A* and first-person movement work unchanged.
// - Cells on the office floor ask the OfficeGrid (shifted by a whole number of cells, so world positions
//   match exactly).
// - The floor's perimeter is closed except at the main door: walls and glass keep blocking.
// - Outdoor cells are walkable inside the park disc unless a shop or a tree trunk is there. They are not
//   stored: each query checks a few obstacles found through a 4 m bucket hash.
// Pure (no three.js) so it can be unit-tested.

export interface BoxObstacle {
  x: number;
  z: number;
  /** Half sizes along the box's own axes. */
  hw: number;
  hd: number;
  /** rotation-y of the box. */
  rot: number;
}

export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

export interface SiteObstacles {
  boxes?: BoxObstacle[];
  circles?: CircleObstacle[];
  /** Walkable outdoor area: a disc around the origin (m). */
  radius: number;
}

const BUCKET = 4;
/** Extra clearance around outdoor obstacles, like INFLATE for furniture. */
const MARGIN = 0.15;

type NavView = { width: number; inside(x: number, z: number): boolean; neighbours(c: Cell): Cell[] };

export class SiteGrid {
  readonly cellSize = NAV_CELL;
  readonly width: number;
  readonly depth: number;
  /** Office cell (0, 0) is site cell (ox, oz). */
  readonly ox: number;
  readonly oz: number;
  /** Office floor size (m), as on OfficeGrid. */
  readonly widthM: number;
  readonly depthM: number;
  private readonly halfW: number;
  private readonly halfD: number;
  private readonly boxes: BoxObstacle[];
  private readonly buckets = new Map<string, CircleObstacle[]>();
  private readonly radius: number;
  private readonly door: { side: 'south' | 'east' | 'west'; from: number; to: number };

  constructor(
    readonly office: OfficeGrid,
    obstacles: SiteObstacles,
  ) {
    this.widthM = office.widthM;
    this.depthM = office.depthM;
    this.radius = obstacles.radius;
    this.ox = Math.max(0, Math.ceil((obstacles.radius - office.widthM / 2) / NAV_CELL));
    this.oz = Math.max(0, Math.ceil((obstacles.radius - office.depthM / 2) / NAV_CELL));
    this.width = office.width + 2 * this.ox;
    this.depth = office.depth + 2 * this.oz;
    this.halfW = office.widthM / 2 + this.ox * NAV_CELL;
    this.halfD = office.depthM / 2 + this.oz * NAV_CELL;
    this.boxes = obstacles.boxes ?? [];
    this.setCircles(obstacles.circles ?? []);
    const { side, offset } = office.layout.shell.door;
    this.door = { side, from: offset, to: offset + DOOR_WIDTH };
  }

  /**
   * Replace the round obstacles (shop tables, tree trunks) in place. The park's trees depend on the detail
   * level and the city, which can change at run time (PerfManager lowers detail); rebuilding the whole grid
   * would recreate every employee brain and teleport people on a break back to their desks (spec 004 T062).
   */
  setCircles(circles: CircleObstacle[]): void {
    this.buckets.clear();
    for (const c of circles) {
      const r = c.r + MARGIN;
      for (let bx = Math.floor((c.x - r) / BUCKET); bx <= Math.floor((c.x + r) / BUCKET); bx++)
        for (let bz = Math.floor((c.z - r) / BUCKET); bz <= Math.floor((c.z + r) / BUCKET); bz++) {
          const k = `${bx},${bz}`;
          const list = this.buckets.get(k);
          if (list) list.push(c);
          else this.buckets.set(k, [c]);
        }
    }
  }

  get layout() {
    return this.office.layout;
  }

  // ---- cells and positions (same contract as OfficeGrid) ----

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  isIndoor(x: number, z: number): boolean {
    return this.office.inside(x - this.ox, z - this.oz);
  }

  /** Is this world point on the office floor? */
  isIndoorAt(wx: number, wz: number): boolean {
    const c = this.toCell(wx, wz);
    return this.isIndoor(c.x, c.z);
  }

  toWorld(c: Cell): [number, number, number] {
    return [(c.x + 0.5) * NAV_CELL - this.halfW, 0, (c.z + 0.5) * NAV_CELL - this.halfD];
  }

  toCell(x: number, z: number): Cell {
    return { x: Math.floor((x + this.halfW) / NAV_CELL), z: Math.floor((z + this.halfD) / NAV_CELL) };
  }

  private fromOffice(c: Cell | null): Cell | null {
    return c && { x: c.x + this.ox, z: c.z + this.oz };
  }

  walkable(x: number, z: number): boolean {
    if (!this.inside(x, z)) return false;
    if (this.isIndoor(x, z)) return this.office.walkable(x - this.ox, z - this.oz);
    const [wx, , wz] = this.toWorld({ x, z });
    return this.outdoorFree(wx, wz);
  }

  /** Outdoor point clear of the park edge, shops and tree trunks. */
  outdoorFree(wx: number, wz: number): boolean {
    if (Math.hypot(wx, wz) > this.radius) return false;
    for (const b of this.boxes) {
      const dx = wx - b.x;
      const dz = wz - b.z;
      const c = Math.cos(b.rot);
      const s = Math.sin(b.rot);
      // Into the box's frame (inverse of rotation-y).
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hw + MARGIN && Math.abs(lz) < b.hd + MARGIN) return false;
    }
    const near = this.buckets.get(`${Math.floor(wx / BUCKET)},${Math.floor(wz / BUCKET)}`);
    if (near) for (const o of near) if (Math.hypot(wx - o.x, wz - o.z) < o.r + MARGIN) return false;
    return true;
  }

  /** Is this indoor (site) cell a door cell, and is `out` the outdoor cell straight through the door? */
  private throughDoor(inCell: Cell, out: Cell): boolean {
    const o = { x: inCell.x - this.ox, z: inCell.z - this.oz };
    const centre = (i: number) => (i + 0.5) * NAV_CELL;
    const dx = out.x - inCell.x;
    const dz = out.z - inCell.z;
    const { side, from, to } = this.door;
    if (side === 'south') return dz === 1 && o.z === this.office.depth - 1 && centre(o.x) > from && centre(o.x) < to;
    if (side === 'east') return dx === 1 && o.x === this.office.width - 1 && centre(o.z) > from && centre(o.z) < to;
    return dx === -1 && o.x === 0 && centre(o.z) > from && centre(o.z) < to;
  }

  canStep(a: Cell, b: Cell): boolean {
    if (!this.walkable(b.x, b.z)) return false;
    if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) !== 1) return false;
    const ain = this.isIndoor(a.x, a.z);
    const bin = this.isIndoor(b.x, b.z);
    if (ain && bin) return this.office.canStep({ x: a.x - this.ox, z: a.z - this.oz }, { x: b.x - this.ox, z: b.z - this.oz });
    if (!ain && !bin) return true;
    return ain ? this.throughDoor(a, b) : this.throughDoor(b, a);
  }

  neighbours(c: Cell): Cell[] {
    const out: Cell[] = [];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = { x: c.x + dx, z: c.z + dz };
      if (this.canStep(c, n)) out.push(n);
    }
    return out;
  }

  /** A* view limited to the office floor, in site cell indices (so Crowd.occupiedCells keys match). */
  indoorView(): NavView {
    return {
      width: this.width,
      inside: (x, z) => this.isIndoor(x, z),
      neighbours: (c) => this.neighbours(c).filter((n) => this.isIndoor(n.x, n.z)),
    };
  }

  // ---- OfficeGrid helpers, in site cells ----

  seatOf(deskId: string): Cell | null {
    return this.fromOffice(this.office.seatOf(deskId));
  }

  approachOf(type: PlacedItem['type']): Cell | null {
    return this.fromOffice(this.office.approachOf(type));
  }

  entrance(): { door: Cell; lobby: Cell } {
    const e = this.office.entrance();
    return { door: this.fromOffice(e.door)!, lobby: this.fromOffice(e.lobby)! };
  }

  /** Nearest walkable cell centre within `maxR` metres of a world point (e.g. to stand up from a sofa). */
  nearestWalkable(wx: number, wz: number, maxR = 1.2, indoorOnly = true): { x: number; z: number } | null {
    const c = this.toCell(wx, wz);
    const r = Math.ceil(maxR / NAV_CELL);
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const n = { x: c.x + dx, z: c.z + dz };
        if (!this.walkable(n.x, n.z) || (indoorOnly && !this.isIndoor(n.x, n.z))) continue;
        const [x, , z] = this.toWorld(n);
        const d = Math.hypot(x - wx, z - wz);
        if (d <= maxR && d < bestD) {
          bestD = d;
          best = { x, z };
        }
      }
    return best;
  }

  /** World point 1.5 m straight out of the main door (where outdoor routes start). */
  doorstep(): { x: number; z: number } {
    const [x, , z] = this.toWorld(this.entrance().door);
    const out = 1.5;
    if (this.door.side === 'south') return { x, z: z + out };
    if (this.door.side === 'east') return { x: x + out, z };
    return { x: x - out, z };
  }
}
