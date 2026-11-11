import { CATALOG, footprintRect, isMeetingTable, seatPoints, type SeatPoint } from './catalog';
import type { OfficeLayout, PlacedItem } from './domain';
import { DOOR_WIDTH } from './domain';

// Navigation grid derived from a v2 layout (research.md R2-03): 0.25 m cells. Blocking furniture marks
// every cell whose centre lies in its footprint grown by INFLATE; walls and glass block the edges they
// run along. Pure (no three.js) so the server's layout validation and the scene share it.

export const NAV_CELL = 0.25;
/** Margin around blocking furniture: keeps the seat cell free and the cell in front of it blocked. */
export const INFLATE = 0.15;

export interface Cell {
  x: number;
  z: number;
}

export class OfficeGrid {
  readonly width: number;
  readonly depth: number;
  readonly cellSize = NAV_CELL;
  readonly widthM: number;
  readonly depthM: number;
  private blockedCells: Uint8Array;
  private blockedNorth: Uint8Array; // edge between (x, z-1) and (x, z)
  private blockedWest: Uint8Array; // edge between (x-1, z) and (x, z)

  constructor(readonly layout: OfficeLayout) {
    this.widthM = layout.floor.width;
    this.depthM = layout.floor.depth;
    this.width = Math.round(this.widthM / NAV_CELL);
    this.depth = Math.round(this.depthM / NAV_CELL);
    const n = this.width * this.depth;
    this.blockedCells = new Uint8Array(n);
    this.blockedNorth = new Uint8Array(n);
    this.blockedWest = new Uint8Array(n);
    for (const item of layout.items) this.apply(item);
  }

  private idx(x: number, z: number): number {
    return z * this.width + x;
  }

  private apply(item: PlacedItem): void {
    const kind = CATALOG[item.type].blocks;
    const r = footprintRect(item);
    if (kind === 'cell') {
      const x0 = Math.max(0, Math.floor((r.x0 - INFLATE) / NAV_CELL));
      const x1 = Math.min(this.width - 1, Math.floor((r.x1 + INFLATE) / NAV_CELL));
      const z0 = Math.max(0, Math.floor((r.z0 - INFLATE) / NAV_CELL));
      const z1 = Math.min(this.depth - 1, Math.floor((r.z1 + INFLATE) / NAV_CELL));
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const cx = (x + 0.5) * NAV_CELL;
          const cz = (z + 0.5) * NAV_CELL;
          if (cx > r.x0 - INFLATE && cx < r.x1 + INFLATE && cz > r.z0 - INFLATE && cz < r.z1 + INFLATE) this.blockedCells[this.idx(x, z)] = 1;
        }
    } else if (kind === 'edge') {
      if (r.z0 === r.z1) {
        const z = Math.round(r.z0 / NAV_CELL);
        if (z <= 0 || z >= this.depth) return;
        for (let x = Math.max(0, Math.floor(r.x0 / NAV_CELL)); x < Math.min(this.width, Math.ceil(r.x1 / NAV_CELL)); x++) this.blockedNorth[this.idx(x, z)] = 1;
      } else {
        const x = Math.round(r.x0 / NAV_CELL);
        if (x <= 0 || x >= this.width) return;
        for (let z = Math.max(0, Math.floor(r.z0 / NAV_CELL)); z < Math.min(this.depth, Math.ceil(r.z1 / NAV_CELL)); z++) this.blockedWest[this.idx(x, z)] = 1;
      }
    }
  }

  inside(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.width && z < this.depth;
  }

  walkable(x: number, z: number): boolean {
    return this.inside(x, z) && this.blockedCells[this.idx(x, z)] === 0;
  }

  /** Can an agent move between two 4-neighbouring cells? */
  canStep(a: Cell, b: Cell): boolean {
    if (!this.walkable(b.x, b.z)) return false;
    if (a.x === b.x && Math.abs(a.z - b.z) === 1) {
      const lower = a.z > b.z ? a : b; // the cell whose north edge is crossed
      return this.blockedNorth[this.idx(lower.x, lower.z)] === 0;
    }
    if (a.z === b.z && Math.abs(a.x - b.x) === 1) {
      const right = a.x > b.x ? a : b;
      return this.blockedWest[this.idx(right.x, right.z)] === 0;
    }
    return false;
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

  /** Cell containing a floor-space point (metres from the north-west corner). */
  floorToCell(x: number, z: number): Cell {
    return { x: Math.floor(x / NAV_CELL), z: Math.floor(z / NAV_CELL) };
  }

  /** World position (metres) of a cell centre; the floor is centred on the origin. */
  toWorld(c: Cell): [number, number, number] {
    return [(c.x + 0.5) * NAV_CELL - this.widthM / 2, 0, (c.z + 0.5) * NAV_CELL - this.depthM / 2];
  }

  toCell(x: number, z: number): Cell {
    return this.floorToCell(x + this.widthM / 2, z + this.depthM / 2);
  }

  /** Seat cell of a desk (`deskId`) or of a meeting-table seat (`<tableId>#<n>`, 007). */
  seatOf(seatId: string): Cell | null {
    const p = findSeat(this.layout, seatId);
    return p ? this.floorToCell(p.x, p.z) : null;
  }

  /** Nearest walkable cell around an item (e.g. in front of the water cooler). */
  approachOf(type: PlacedItem['type']): Cell | null {
    const item = this.layout.items.find((i) => i.type === type);
    if (!item) return null;
    const r = footprintRect(item);
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    let best: Cell | null = null;
    let bestD = Infinity;
    const reach = 1.0;
    const x0 = Math.max(0, Math.floor((r.x0 - reach) / NAV_CELL));
    const x1 = Math.min(this.width - 1, Math.floor((r.x1 + reach) / NAV_CELL));
    const z0 = Math.max(0, Math.floor((r.z0 - reach) / NAV_CELL));
    const z1 = Math.min(this.depth - 1, Math.floor((r.z1 + reach) / NAV_CELL));
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        if (!this.walkable(x, z)) continue;
        const d = Math.hypot((x + 0.5) * NAV_CELL - cx, (z + 0.5) * NAV_CELL - cz);
        if (d < bestD) {
          bestD = d;
          best = { x, z };
        }
      }
    return best;
  }

  /** Door cell (entry/exit point, on the floor edge) and a lobby cell about 1 m inside it. */
  entrance(): { door: Cell; lobby: Cell } {
    const { side, offset } = this.layout.shell.door;
    const mid = offset + DOOR_WIDTH / 2;
    const edge = NAV_CELL / 2;
    let door: Cell;
    let lobby: Cell;
    if (side === 'south') {
      door = this.floorToCell(mid, this.depthM - edge);
      lobby = this.floorToCell(mid, this.depthM - 1);
    } else if (side === 'east') {
      door = this.floorToCell(this.widthM - edge, mid);
      lobby = this.floorToCell(this.widthM - 1, mid);
    } else {
      door = this.floorToCell(edge, mid);
      lobby = this.floorToCell(1, mid);
    }
    if (!this.walkable(lobby.x, lobby.z)) lobby = door;
    return { door, lobby };
  }
}

/** A desk id or `<tableId>#<n>` → that seat in the layout, or null (split at the last `#`, table and n checked). */
export function findSeat(layout: Pick<OfficeLayout, 'items'>, seatId: string): SeatPoint | null {
  const hash = seatId.lastIndexOf('#');
  const itemId = hash < 0 ? seatId : seatId.slice(0, hash);
  const item = layout.items.find((i) => i.id === itemId);
  if (!item || (hash < 0 ? item.type !== 'desk' : !isMeetingTable(item.type))) return null;
  return seatPoints(item).find((s) => s.id === seatId) ?? null;
}
