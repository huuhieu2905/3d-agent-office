import type { VisualState } from '@shared/domain';
import type { Clip } from './character';
import { findPath } from './grid/astar';
import type { Cell, OfficeGrid } from './grid/grid';

// Per-employee behaviour (FR-012, R15): sit at the assigned desk, act out the real status, and when idle
// do a random break every 5 ± 2 minutes (stretch, or walk to the water cooler and back to the SAME desk).
// Pure logic (no React/three) so it can be unit-tested.

export const BREAK_MEAN_MS = 5 * 60_000;
export const BREAK_JITTER_MS = 2 * 60_000;
const WALK_SPEED = 1.1; // m/s

type Mode =
  | { kind: 'entering'; path: Cell[]; i: number }
  | { kind: 'seated' }
  | { kind: 'lobby' }
  | { kind: 'walking'; path: Cell[]; i: number; then: 'drink' | 'sit' | 'leave-done' }
  | { kind: 'acting'; clip: Clip; until: number; then: 'return' | 'sit' }
  | { kind: 'left' };

export interface Pose {
  x: number;
  z: number;
  heading: number; // radians around Y; 0 = facing +z
  clip: Clip;
  seated: boolean;
}

export interface BrainOptions {
  grid: OfficeGrid;
  seat: Cell | null;
  lobbySlot?: number;
  rng?: () => number;
  /** Start at the door and walk in (new employee). */
  enter?: boolean;
  now?: number;
}

export class EmployeeBrain {
  private mode: Mode;
  private x = 0;
  private z = 0;
  private heading = Math.PI;
  private nextBreakAt: number;
  private visual: VisualState = 'idle';
  private rng: () => number;
  private seat: Cell | null;

  constructor(private readonly o: BrainOptions) {
    this.rng = o.rng ?? Math.random;
    this.seat = o.seat;
    const now = o.now ?? Date.now();
    // Stagger: the first break is spread uniformly over the first interval so nobody stands up together.
    this.nextBreakAt = now + this.rng() * (BREAK_MEAN_MS + BREAK_JITTER_MS);
    const { door } = o.grid.entrance();
    if (o.enter) {
      this.place(door);
      const target = this.homeCell();
      const path = findPath(o.grid, door, target);
      this.mode = path ? { kind: 'entering', path, i: 0 } : this.atHome();
    } else {
      this.place(this.homeCell());
      this.mode = this.atHome();
    }
  }

  get done(): boolean {
    return this.mode.kind === 'left';
  }

  get modeKind(): Mode['kind'] {
    return this.mode.kind;
  }

  private homeCell(): Cell {
    if (this.seat) return this.seat;
    const { lobby } = this.o.grid.entrance();
    const slot = this.o.lobbySlot ?? 0;
    const offs = [0, 1, -1, 2, -2, 3, -3];
    for (const dx of offs.slice(slot % offs.length)) {
      const c = { x: lobby.x + dx, z: lobby.z - Math.floor(slot / offs.length) };
      if (this.o.grid.walkable(c.x, c.z)) return c;
    }
    return lobby;
  }

  private atHome(): Mode {
    const home = this.homeCell();
    this.place(home);
    if (this.seat) {
      this.heading = this.deskFacing();
      return { kind: 'seated' };
    }
    this.heading = Math.PI;
    return { kind: 'lobby' };
  }

  private place(c: Cell): void {
    const [x, , z] = this.o.grid.toWorld(c);
    this.x = x;
    this.z = z;
  }

  /** Face the desk: the seat is one cell outside the desk footprint, so look at the nearest desk cell. */
  private deskFacing(): number {
    const s = this.seat!;
    for (const [dx, dz] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      if (!this.o.grid.walkable(s.x + dx, s.z + dz)) return Math.atan2(dx, dz);
    }
    return Math.PI;
  }

  /** Desk changed (drag & drop or new assignment): walk to the new seat. */
  setSeat(seat: Cell | null, now = Date.now()): void {
    const same = (a: Cell | null, b: Cell | null) => (a && b ? a.x === b.x && a.z === b.z : a === b);
    if (same(seat, this.seat)) return;
    this.seat = seat;
    if (this.mode.kind === 'left') return;
    this.walkTo(this.homeCell(), 'sit', now);
  }

  setVisual(v: VisualState, now = Date.now()): void {
    const prev = this.visual;
    this.visual = v;
    if (v === prev) return;
    // Real work always wins over a break: go straight back to the desk (R5, Constitution I).
    if (v !== 'idle' && v !== 'disconnected' && (this.mode.kind === 'walking' || this.mode.kind === 'acting')) {
      if (this.mode.kind === 'walking' && this.mode.then === 'leave-done') return;
      this.walkTo(this.homeCell(), 'sit', now);
    }
    if (v === 'idle' && prev !== 'idle') this.scheduleBreak(now);
  }

  leave(now = Date.now()): void {
    const { door } = this.o.grid.entrance();
    const from = this.o.grid.toCell(this.x, this.z);
    const path = findPath(this.o.grid, from, door);
    if (!path) {
      this.mode = { kind: 'left' };
      return;
    }
    this.mode = { kind: 'walking', path, i: 0, then: 'leave-done' };
    void now;
  }

  private scheduleBreak(now: number): void {
    this.nextBreakAt = now + BREAK_MEAN_MS + (this.rng() * 2 - 1) * BREAK_JITTER_MS;
  }

  private walkTo(target: Cell, then: 'drink' | 'sit' | 'leave-done', now: number): void {
    const from = this.o.grid.toCell(this.x, this.z);
    const path = findPath(this.o.grid, from, target);
    if (!path || path.length < 2) {
      if (then === 'sit') this.mode = this.atHome();
      else if (then === 'drink') this.mode = { kind: 'acting', clip: 'Yes', until: now + 3000, then: 'return' };
      else this.mode = { kind: 'left' };
      return;
    }
    this.mode = { kind: 'walking', path, i: 0, then };
  }

  private startBreak(now: number): void {
    const cooler = this.o.grid.approachOf('water_cooler');
    if (cooler && this.rng() < 0.6) this.walkTo(cooler, 'drink', now);
    else this.mode = { kind: 'acting', clip: 'ThumbsUp', until: now + 3500, then: 'sit' };
    this.scheduleBreak(now);
  }

  /** Advance by dt seconds and return the pose to render. */
  tick(dt: number, now = Date.now()): Pose {
    const m = this.mode;
    if (this.visual === 'disconnected') return this.pose('Idle', m.kind === 'seated');

    switch (m.kind) {
      case 'seated':
        if (this.visual === 'idle' && now >= this.nextBreakAt) this.startBreak(now);
        return this.pose(this.seatedClip(), true);
      case 'lobby':
        return this.pose(this.visual === 'waiting_for_boss' ? 'Wave' : 'Idle', false);
      case 'entering':
      case 'walking': {
        const arrived = this.followPath(m, dt);
        if (arrived) {
          if (m.kind === 'entering') this.mode = this.atHome();
          else if (m.then === 'drink') this.mode = { kind: 'acting', clip: 'Yes', until: now + 3000, then: 'return' };
          else if (m.then === 'leave-done') this.mode = { kind: 'left' };
          else this.mode = this.atHome();
        }
        return this.pose('Walking', false);
      }
      case 'acting':
        if (now >= m.until) {
          if (m.then === 'return') this.walkTo(this.homeCell(), 'sit', now);
          else this.mode = this.atHome();
        }
        return this.pose(m.clip, false);
      case 'left':
        return this.pose('Idle', false);
    }
  }

  private seatedClip(): Clip {
    switch (this.visual) {
      case 'waiting_for_boss':
        return 'Wave';
      case 'error':
        return 'No';
      default:
        return 'Sitting';
    }
  }

  private followPath(m: { path: Cell[]; i: number }, dt: number): boolean {
    let budget = WALK_SPEED * dt;
    while (budget > 0 && m.i < m.path.length) {
      const [tx, , tz] = this.o.grid.toWorld(m.path[m.i]!);
      const dx = tx - this.x;
      const dz = tz - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= budget) {
        this.x = tx;
        this.z = tz;
        budget -= dist;
        m.i++;
      } else {
        this.x += (dx / dist) * budget;
        this.z += (dz / dist) * budget;
        this.heading = Math.atan2(dx, dz);
        budget = 0;
      }
    }
    return m.i >= m.path.length;
  }

  private pose(clip: Clip, seated: boolean): Pose {
    return { x: this.x, z: this.z, heading: this.heading, clip, seated };
  }
}
