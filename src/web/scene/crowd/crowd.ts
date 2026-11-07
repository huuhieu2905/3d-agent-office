import type { Cell, OfficeGrid } from '../grid/grid';

// 002 US3 / R2-04 / data-model §5: one crowd for the whole office. Employees never overlap and never walk
// through furniture or walls.
//
// Moves are resolved one agent at a time (Gauss–Seidel): an agent may only take a step that keeps it at
// least r_a + r_b away from every other agent's *current* position and keeps its centre on walkable
// cells without crossing a blocked edge. Every accepted state is therefore overlap-free — the invariant
// holds after every single move, not just on average. When the straight step is refused the agent tries
// to sidestep (±45°, ±90°); lower-priority agents yield (stand still) when a higher-priority one is close
// ahead. Contacts produce bump events that the employee brains turn into short reactions.
// Pure TypeScript (no React/three) so it can be simulated for minutes in a unit test.

export const RADIUS_WALKING = 0.28;
/** A seated employee is mostly behind/under the desk, so others may pass a little closer. */
export const RADIUS_SEATED = 0.2;
/** Contact = within this margin of touching. */
const CONTACT = 0.04;
/** Below this approach speed a touch is a gentle brush, not a bump (FR-018). */
const BUMP_SPEED = 0.3;
const BUMP_COOLDOWN_MS = 1500;
/** Stop giving way after this long (s), so nobody waits forever in a circle. */
const YIELD_LIMIT_S = 1.5;
/** Start trying backward sidesteps after being stuck this long (s). */
const BACKOFF_AFTER_S = 1;

export type BumpKind = 'bump_person' | 'bump_object';

export interface BumpEvent {
  kind: BumpKind;
  /** World position of whatever was bumped (the other person, or the refused point). */
  x: number;
  z: number;
  other?: string;
}

export interface Agent {
  id: string;
  x: number;
  z: number;
  seated: boolean;
  /** Higher wins right of way. Walking back to the desk beats a break walk (R2-04). */
  priority: number;
  /** m/s of the last accepted move, for bump detection. */
  speed: number;
  lastBumpAt: number;
  events: BumpEvent[];
}

export interface StepResult {
  x: number;
  z: number;
  /** Fraction of the requested distance actually travelled (0..1). */
  progress: number;
  yielded: boolean;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};

export class Crowd {
  private agents = new Map<string, Agent>();
  /** Pairs currently touching: a bump fires when contact *starts*, not on every frame of it. */
  private touching = new Set<string>();

  constructor(readonly grid: Pick<OfficeGrid, 'toCell' | 'toWorld' | 'walkable' | 'canStep' | 'inside' | 'width' | 'neighbours'>) {}

  radius(a: Agent): number {
    return a.seated ? RADIUS_SEATED : RADIUS_WALKING;
  }

  /** Register or update an agent. Seated agents are static obstacles with infinite mass. */
  place(id: string, x: number, z: number, opts: { seated?: boolean; priority?: number } = {}): Agent {
    let a = this.agents.get(id);
    if (!a) {
      a = { id, x, z, seated: false, priority: 0, speed: 0, lastBumpAt: -Infinity, events: [] };
      this.agents.set(id, a);
    }
    a.x = x;
    a.z = z;
    a.seated = opts.seated ?? a.seated;
    a.priority = opts.priority ?? a.priority;
    a.speed = 0;
    return a;
  }

  setSeated(id: string, seated: boolean): void {
    const a = this.agents.get(id);
    if (a) a.seated = seated;
  }

  setPriority(id: string, priority: number): void {
    const a = this.agents.get(id);
    if (a) a.priority = priority;
  }

  remove(id: string): void {
    this.agents.delete(id);
    for (const k of this.touching) if (k.startsWith(`${id}|`) || k.endsWith(`|${id}`)) this.touching.delete(k);
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  all(): Agent[] {
    return [...this.agents.values()];
  }

  /** Events addressed to this agent since the last call. */
  takeEvents(id: string): BumpEvent[] {
    const a = this.agents.get(id);
    if (!a || a.events.length === 0) return [];
    const ev = a.events;
    a.events = [];
    return ev;
  }

  /** Would `id` standing at (x, z) keep clear of everyone else? */
  clearOfPeople(id: string, x: number, z: number, r = RADIUS_WALKING): Agent | null {
    for (const o of this.agents.values()) {
      if (o.id === id) continue;
      if (Math.hypot(o.x - x, o.z - z) < r + this.radius(o) - 1e-9) return o;
    }
    return null;
  }

  /** Centre on walkable cells, and no blocked edge between the current cell and the next. */
  clearOfObjects(fromX: number, fromZ: number, x: number, z: number): boolean {
    const a = this.grid.toCell(fromX, fromZ);
    const b = this.grid.toCell(x, z);
    if (!this.grid.walkable(b.x, b.z)) return false;
    if (a.x === b.x && a.z === b.z) return true;
    if (Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1) return this.grid.canStep(a, b);
    // Diagonal: allowed only if one of the two L-shaped routes is open.
    const viaX = { x: b.x, z: a.z };
    const viaZ = { x: a.x, z: b.z };
    return (this.grid.canStep(a, viaX) && this.grid.canStep(viaX, b)) || (this.grid.canStep(a, viaZ) && this.grid.canStep(viaZ, b));
  }

  /**
   * Move `id` up to `dist` metres towards (tx, tz). Returns where it ended up. Never creates an overlap.
   * `dt` (s) is used for speeds; `now` (ms) for bump cooldowns.
   */
  step(id: string, tx: number, tz: number, dist: number, dt: number, now: number, stuckFor = 0): StepResult {
    const a = this.agents.get(id);
    if (!a) return { x: tx, z: tz, progress: 1, yielded: false };
    const dx = tx - a.x;
    const dz = tz - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6 || dist <= 0) {
      a.speed = 0;
      return { x: a.x, z: a.z, progress: 1, yielded: false };
    }
    const want = Math.min(dist, len);
    const ux = dx / len;
    const uz = dz / len;

    // Right of way: yield to a higher-priority walker close ahead (within ~1 m, in front) — but only for a
    // while: after YIELD_LIMIT_S everyone may squeeze past, which breaks circular waits.
    for (const o of stuckFor > YIELD_LIMIT_S ? [] : this.agents.values()) {
      if (o.id === id || o.seated) continue;
      const ox = o.x - a.x;
      const oz = o.z - a.z;
      const d = Math.hypot(ox, oz);
      if (d < 0.9 && (ox * ux + oz * uz) / (d || 1) > 0.5 && this.outranks(o, a)) {
        a.speed = 0;
        return { x: a.x, z: a.z, progress: 0, yielded: true };
      }
    }

    // Straight, then sidesteps; the first candidate that is clear wins.
    const r = this.radius(a);
    let blocker: Agent | null = null;
    let objectRefused: { x: number; z: number } | null = null;
    // Stuck for a moment: also allow stepping back / diagonally back, so face-offs untangle.
    const angles = stuckFor > BACKOFF_AFTER_S ? [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI] : [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2];
    for (const angle of angles) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const vx = ux * c - uz * s;
      const vz = ux * s + uz * c;
      const step = angle === 0 ? want : Math.min(want, (Math.abs(angle) > Math.PI / 2 ? 0.4 : 0.6) * dist);
      const nx = a.x + vx * step;
      const nz = a.z + vz * step;
      if (!this.clearOfObjects(a.x, a.z, nx, nz)) {
        objectRefused ??= { x: nx, z: nz };
        continue;
      }
      const hit = this.clearOfPeople(id, nx, nz, r);
      if (hit) {
        blocker ??= hit;
        continue;
      }
      const moved = Math.hypot(nx - a.x, nz - a.z);
      const progress = Math.max(0, ((nx - a.x) * ux + (nz - a.z) * uz) / want);
      a.x = nx;
      a.z = nz;
      a.speed = dt > 0 ? moved / dt : 0;
      this.detectContacts(a, now);
      return { x: a.x, z: a.z, progress, yielded: false };
    }

    // Fully blocked this frame.
    const approach = dt > 0 ? want / dt : 0;
    if (blocker) this.bump(a, blocker, approach, now);
    else if (objectRefused && approach > BUMP_SPEED) this.emit(a, { kind: 'bump_object', x: objectRefused.x, z: objectRefused.z }, now);
    a.speed = 0;
    return { x: a.x, z: a.z, progress: 0, yielded: false };
  }

  /** Higher priority wins; ties are broken by a stable hash of the ids so exactly one side yields. */
  private outranks(o: Agent, a: Agent): boolean {
    if (o.priority !== a.priority) return o.priority > a.priority;
    return hash(o.id) > hash(a.id);
  }

  private detectContacts(a: Agent, now: number): void {
    for (const o of this.agents.values()) {
      if (o.id === a.id) continue;
      const d = Math.hypot(o.x - a.x, o.z - a.z);
      const reach = this.radius(a) + this.radius(o);
      if (d < reach + CONTACT) this.bump(a, o, a.speed + o.speed, now);
      else if (d > reach + 0.15) this.touching.delete(a.id < o.id ? `${a.id}|${o.id}` : `${o.id}|${a.id}`);
    }
  }

  private bump(a: Agent, o: Agent, relSpeed: number, now: number): void {
    const key = a.id < o.id ? `${a.id}|${o.id}` : `${o.id}|${a.id}`;
    if (this.touching.has(key)) return;
    this.touching.add(key);
    if (relSpeed <= BUMP_SPEED) return;
    this.emit(a, { kind: 'bump_person', x: o.x, z: o.z, other: o.id }, now);
    if (!o.seated) this.emit(o, { kind: 'bump_person', x: a.x, z: a.z, other: a.id }, now);
  }

  private emit(a: Agent, e: BumpEvent, now: number): void {
    if (now - a.lastBumpAt < BUMP_COOLDOWN_MS) return;
    a.lastBumpAt = now;
    a.events.push(e);
  }

  /**
   * Cells a walker should not plan through: too close to a seated employee (except the walker's own seat),
   * and — when re-planning after being stuck — too close to anyone standing still.
   */
  occupiedCells(exceptId: string, seat: Cell | null, includeStanding = false): Set<number> {
    const out = new Set<number>();
    for (const o of this.agents.values()) {
      if (o.id === exceptId || (!o.seated && !(includeStanding && o.speed < 0.05))) continue;
      const min = RADIUS_WALKING + this.radius(o);
      const c = this.grid.toCell(o.x, o.z);
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          const n = { x: c.x + dx, z: c.z + dz };
          if (!this.grid.inside(n.x, n.z) || (seat && n.x === seat.x && n.z === seat.z)) continue;
          const [wx, , wz] = this.grid.toWorld(n);
          if (Math.hypot(wx - o.x, wz - o.z) < min) out.add(n.z * this.grid.width + n.x);
        }
    }
    return out;
  }
}

/** A grid view for A* that also avoids the given cells (keeps start and goal reachable). */
export function avoiding<G extends Pick<OfficeGrid, 'width' | 'inside' | 'neighbours'>>(grid: G, blocked: Set<number>, keep: Cell[]): Pick<OfficeGrid, 'width' | 'inside' | 'neighbours'> {
  const keepKeys = new Set(keep.map((c) => c.z * grid.width + c.x));
  return {
    width: grid.width,
    inside: (x, z) => grid.inside(x, z),
    neighbours: (c) => grid.neighbours(c).filter((n) => keepKeys.has(n.z * grid.width + n.x) || !blocked.has(n.z * grid.width + n.x)),
  };
}
