import type { OfficeLayout } from '@shared/domain';
import { footprintRect } from '@shared/catalog';

// 008 US1/US2 (research R8-01): open/closed state of every office door. Pure (no React/three) so it can be
// unit-tested; one per layout, created in OfficeScene like SpotBook. Everything is in world metres (floor
// centred on the origin), the frame employees, the camera and `positions` already use. Nothing is saved.

/** Fully open in this many seconds (a waiting employee is released at 80 %, well under 1 s — SC-002). */
const OPEN_S = 0.6;
/** Close this long after the doorway became clear (FR-002). */
const CLOSE_AFTER_MS = 2000;
/** Someone this close to the door line (and within its length) is "in the doorway" (FR-006). */
const DOORWAY = 0.4;
/** First-person body radius used when a move is tested against a closed door. */
const BODY = 0.2;

interface DoorState {
  id: string;
  /** Door line, world metres. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  openness: number;
  holders: Set<string>;
  userOpen: boolean;
  clearSince: number;
}

const cross = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);

/** Do the segments p→q and a→b intersect (touching counts)? */
function segmentsCross(px: number, pz: number, qx: number, qz: number, ax: number, az: number, bx: number, bz: number): boolean {
  const d1 = cross(ax, az, bx, bz, px, pz);
  const d2 = cross(ax, az, bx, bz, qx, qz);
  const d3 = cross(px, pz, qx, qz, ax, az);
  const d4 = cross(px, pz, qx, qz, bx, bz);
  return d1 * d2 <= 0 && d3 * d4 <= 0 && !(d1 === 0 && d2 === 0);
}

/** Distance from a point to a segment. */
function distToSegment(x: number, z: number, d: DoorState): number {
  const vx = d.x1 - d.x0;
  const vz = d.z1 - d.z0;
  const t = Math.max(0, Math.min(1, ((x - d.x0) * vx + (z - d.z0) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - (d.x0 + t * vx), z - (d.z0 + t * vz));
}

export class DoorBook {
  private readonly doors = new Map<string, DoorState>();

  constructor(layout: Pick<OfficeLayout, 'floor' | 'items'>) {
    const hw = layout.floor.width / 2;
    const hd = layout.floor.depth / 2;
    for (const it of layout.items) {
      if (it.type !== 'office_door') continue;
      const r = footprintRect(it);
      this.doors.set(it.id, { id: it.id, x0: r.x0 - hw, z0: r.z0 - hd, x1: r.x1 - hw, z1: r.z1 - hd, openness: 0, holders: new Set(), userOpen: false, clearSince: 0 });
    }
  }

  get ids(): string[] {
    return [...this.doors.keys()];
  }

  openness(id: string): number {
    return this.doors.get(id)?.openness ?? 0;
  }

  isOpen(id: string): boolean {
    return this.openness(id) >= 0.8;
  }

  isUserOpen(id: string): boolean {
    return this.doors.get(id)?.userOpen ?? false;
  }

  request(id: string, who: string): void {
    this.doors.get(id)?.holders.add(who);
  }

  /** `who` has passed: let go, and the door returns to its rest state (closed) even if the user had opened it. */
  release(id: string, who: string): void {
    const d = this.doors.get(id);
    if (!d || !d.holders.delete(who)) return;
    d.userOpen = false;
  }

  /** Drop every door `who` is holding (mode change, left the office). */
  releaseAll(who: string): void {
    for (const d of this.doors.values()) d.holders.delete(who);
  }

  toggleUser(id: string): void {
    const d = this.doors.get(id);
    if (d) d.userOpen = !(d.userOpen || d.openness >= 0.8);
  }

  /** The office door whose line the straight walk p→q crosses (line extended 5 cm at each end), or null. */
  doorBetween(px: number, pz: number, qx: number, qz: number): string | null {
    for (const d of this.doors.values()) {
      const len = Math.hypot(d.x1 - d.x0, d.z1 - d.z0);
      const ex = ((d.x1 - d.x0) / len) * 0.05;
      const ez = ((d.z1 - d.z0) / len) * 0.05;
      if (segmentsCross(px, pz, qx, qz, d.x0 - ex, d.z0 - ez, d.x1 + ex, d.z1 + ez)) return d.id;
    }
    return null;
  }

  /** Nearest office door within `r` metres of (x, z). */
  doorNear(x: number, z: number, r: number): string | null {
    let best: string | null = null;
    let bestD = r;
    for (const d of this.doors.values()) {
      const dist = distToSegment(x, z, d);
      if (dist <= bestD) {
        bestD = dist;
        best = d.id;
      }
    }
    return best;
  }

  /** Would a body moving from (x0, z0) to (x1, z1) pass through a door that is not open? (FR-005) */
  blocksMove(x0: number, z0: number, x1: number, z1: number): boolean {
    for (const d of this.doors.values()) {
      if (d.openness >= 0.8) continue;
      // The body's front edge: extend the move by the body radius so it stops before the leaf.
      const len = Math.hypot(x1 - x0, z1 - z0) || 1;
      const fx = x1 + ((x1 - x0) / len) * BODY;
      const fz = z1 + ((z1 - z0) / len) * BODY;
      if (segmentsCross(x0, z0, fx, fz, d.x0, d.z0, d.x1, d.z1)) return true;
    }
    return false;
  }

  /** Advance the animation; `people` are everyone who can stand in a doorway (employees, the player). */
  tick(dt: number, now: number, people: Iterable<{ x: number; z: number }>): void {
    const list = [...people];
    for (const d of this.doors.values()) {
      // Someone in the doorway keeps a door that is (even partly) open from closing on them (FR-006), but
      // never opens a closed one: employees ask for it, the user presses E.
      const blocking = d.openness > 0 && list.some((p) => distToSegment(p.x, p.z, d) < DOORWAY);
      if (blocking || d.holders.size > 0) d.clearSince = now;
      const open = d.holders.size > 0 || d.userOpen || blocking || now - d.clearSince < CLOSE_AFTER_MS;
      const step = dt / OPEN_S;
      d.openness = open ? Math.min(1, d.openness + step) : Math.max(0, d.openness - step);
    }
  }
}
