import { CATALOG, footprintCells, seatCell } from '@shared/catalog';
import type { OfficeLayout, PlacedItem } from '@shared/domain';

// Walkability map on 0.5 m cells (research.md R15). Cell items block cells; walls/glass block one edge:
// rotation 0/180 → the north (z-min) edge of the cell, rotation 90/270 → the west (x-min) edge.

export interface Cell {
  x: number;
  z: number;
}

export class OfficeGrid {
  readonly width: number;
  readonly depth: number;
  readonly cellSize: number;
  private blockedCells: Uint8Array;
  private blockedNorth: Uint8Array; // edge between (x, z-1) and (x, z)
  private blockedWest: Uint8Array; // edge between (x-1, z) and (x, z)

  constructor(readonly layout: OfficeLayout) {
    this.width = layout.floor.widthCells;
    this.depth = layout.floor.depthCells;
    this.cellSize = layout.floor.cellSize;
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
    if (kind === 'cell') {
      for (const c of footprintCells(item)) if (this.inside(c.x, c.z)) this.blockedCells[this.idx(c.x, c.z)] = 1;
    } else if (kind === 'edge') {
      const { x, z } = item.cell;
      if (!this.inside(x, z)) return;
      if (item.rotation === 0 || item.rotation === 180) this.blockedNorth[this.idx(x, z)] = 1;
      else this.blockedWest[this.idx(x, z)] = 1;
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

  /** World position (metres) of a cell centre; the floor is centred on the origin. */
  toWorld(c: Cell): [number, number, number] {
    return [(c.x + 0.5) * this.cellSize - (this.width * this.cellSize) / 2, 0, (c.z + 0.5) * this.cellSize - (this.depth * this.cellSize) / 2];
  }

  toCell(x: number, z: number): Cell {
    return {
      x: Math.floor((x + (this.width * this.cellSize) / 2) / this.cellSize),
      z: Math.floor((z + (this.depth * this.cellSize) / 2) / this.cellSize),
    };
  }

  seatOf(deskId: string): Cell | null {
    const desk = this.layout.items.find((i) => i.id === deskId && i.type === 'desk');
    return desk ? seatCell(desk) : null;
  }

  /** Walkable cell next to an item (e.g. in front of the water cooler or inside the door). */
  approachOf(type: PlacedItem['type']): Cell | null {
    const item = this.layout.items.find((i) => i.type === type);
    if (!item) return null;
    const cells = footprintCells(item);
    for (const c of cells) {
      for (const n of [
        { x: c.x, z: c.z - 1 },
        { x: c.x, z: c.z + 1 },
        { x: c.x - 1, z: c.z },
        { x: c.x + 1, z: c.z },
      ]) {
        if (this.walkable(n.x, n.z) && !cells.some((k) => k.x === n.x && k.z === n.z)) return n;
      }
    }
    return null;
  }

  /** Door cell (entry/exit point) and a lobby cell just inside it. */
  entrance(): { door: Cell; lobby: Cell } {
    const door = this.layout.items.find((i) => i.type === 'door');
    const d = door ? { x: door.cell.x, z: door.cell.z } : { x: Math.floor(this.width / 2), z: this.depth - 1 };
    let lobby = { x: d.x, z: d.z - 2 };
    if (!this.walkable(lobby.x, lobby.z)) lobby = { x: d.x, z: d.z - 1 };
    return { door: d, lobby };
  }
}
