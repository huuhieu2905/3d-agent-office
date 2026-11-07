import type { VisualState } from '@shared/domain';
import type { Clip } from './character';
import { findPath } from './grid/astar';
import type { Cell, OfficeGrid } from './grid/grid';
import { avoiding, RADIUS_WALKING, type BumpEvent, type Crowd } from './crowd/crowd';

// Per-employee behaviour (FR-012, R15): sit at the assigned desk, act out the real status, and when idle
// do a random break every 5 ± 2 minutes (stretch, or walk to the water cooler and back to the SAME desk).
// 002 US3 (R2-04): the brain decides *where* to go; when a shared Crowd is given, the crowd decides *how*
// far each step may go, so employees never overlap, give way to each other and react to bumps.
// Pure logic (no React/three) so it can be unit-tested.

export const BREAK_MEAN_MS = 5 * 60_000;
export const BREAK_JITTER_MS = 2 * 60_000;
const WALK_SPEED = 1.1; // m/s
/** Stuck this long (s) → plan a new route around whoever is in the way (FR-021 allows up to 5 s). */
const REPLAN_AFTER_S = 2;
/** Blocked this long (s) on a waypoint someone stands on → aim at the next one. */
const SKIP_WAYPOINT_AFTER_S = 0.3;
/** Blocked this long (s) within QUEUE_RADIUS (m) of a shared spot → use it from here. */
const QUEUE_AFTER_S = 1.5;
const QUEUE_RADIUS = 1.4;
/** Lobby slots are spread out so waiting employees never overlap (0.25 m cells). */
const LOBBY_SPACING = 3;

type Mode =
  | { kind: 'entering'; path: Cell[]; i: number }
  | { kind: 'seated' }
  | { kind: 'lobby' }
  | { kind: 'walking'; path: Cell[]; i: number; then: 'drink' | 'sit' | 'leave-done' }
  | { kind: 'acting'; clip: Clip; until: number; then: 'return' | 'sit' }
  | { kind: 'left' };

export interface Reaction {
  kind: BumpEvent['kind'];
  /** 0 → 1 over the reaction. */
  t: number;
  /** Heading towards whatever was bumped (radians). */
  towards: number;
  /** World position of what was bumped. */
  x: number;
  z: number;
  /** Increments for every new bump, so the view can fire one-off effects. */
  seq: number;
}

export interface Pose {
  x: number;
  z: number;
  heading: number; // radians around Y; 0 = facing +z
  clip: Clip;
  seated: boolean;
  /** A short bump reaction in progress (FR-018); purely visual, never changes the employee's status. */
  reaction?: Reaction | null;
}

export interface BrainOptions {
  grid: OfficeGrid;
  seat: Cell | null;
  lobbySlot?: number;
  rng?: () => number;
  /** Start at the door and walk in (new employee). */
  enter?: boolean;
  now?: number;
  /** Shared crowd (US3). Without one the brain moves freely, as in feature 001. */
  crowd?: Crowd;
  id?: string;
  /** Override the break interval (tests, ?debug=crowd). */
  breakMeanMs?: number;
  breakJitterMs?: number;
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
  private readonly id: string;
  private blockedFor = 0;
  /** A waypoint was skipped during the current blockage (skip at most one at a time). */
  private skipped = false;
  private reaction: { kind: BumpEvent['kind']; from: number; until: number; towards: number; x: number; z: number; seq: number } | null = null;
  private bumpSeq = 0;
  private readonly breakMean: number;
  private readonly breakJitter: number;
  /** New employee queueing outside the door until the doorway is free (US3). */
  private waitingOutside = false;
  /** Clock of the current tick (ms), so poses and reactions use the caller's time. */
  private lastNow = 0;

  constructor(private readonly o: BrainOptions) {
    this.rng = o.rng ?? Math.random;
    this.seat = o.seat;
    this.id = o.id ?? `brain-${Math.floor(this.rng() * 1e9)}`;
    this.breakMean = o.breakMeanMs ?? BREAK_MEAN_MS;
    this.breakJitter = o.breakJitterMs ?? BREAK_JITTER_MS;
    const now = o.now ?? Date.now();
    // Stagger: the first break is spread uniformly over the first interval so nobody stands up together.
    this.nextBreakAt = now + this.rng() * (this.breakMean + this.breakJitter);
    const { door } = o.grid.entrance();
    if (o.enter) {
      this.place(door);
      const target = this.homeCell();
      const path = this.plan(door, target);
      if (!path) this.mode = this.atHome();
      else {
        this.mode = { kind: 'entering', path, i: 0 };
        // With a crowd, wait just outside the door until the doorway is clear (no overlap on arrival).
        if (o.crowd) {
          this.waitingOutside = true;
          this.stepOutside(o.lobbySlot ?? 0);
          this.tryEnter();
        }
      }
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

  get position(): { x: number; z: number } {
    return { x: this.x, z: this.z };
  }

  /** Remove from the shared crowd (component unmount). */
  dispose(): void {
    this.o.crowd?.remove(this.id);
  }

  private homeCell(): Cell {
    if (this.seat) return this.seat;
    const { lobby } = this.o.grid.entrance();
    const slot = this.o.lobbySlot ?? 0;
    const offs = [0, 1, -1, 2, -2, 3, -3].map((k) => k * LOBBY_SPACING);
    const row = Math.floor(slot / offs.length) * LOBBY_SPACING;
    for (const dx of offs.slice(slot % offs.length)) {
      const c = { x: lobby.x + dx, z: lobby.z - row };
      if (this.o.grid.walkable(c.x, c.z)) return c;
    }
    return lobby;
  }

  private atHome(): Mode {
    const home = this.homeCell();
    this.place(home);
    if (this.seat) {
      this.heading = this.deskFacing();
      this.o.crowd?.place(this.id, this.x, this.z, { seated: true, priority: 0 });
      return { kind: 'seated' };
    }
    this.heading = Math.PI;
    this.o.crowd?.place(this.id, this.x, this.z, { seated: false, priority: 0 });
    return { kind: 'lobby' };
  }

  private place(c: Cell): void {
    const [x, , z] = this.o.grid.toWorld(c);
    this.x = x;
    this.z = z;
  }

  /** Face the desk: the seat is next to the desk footprint, so look at the nearest blocked cell. */
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

  /** Stand outside the office in front of the door (queue position `slot`). */
  private stepOutside(slot: number): void {
    const { door } = this.o.grid.entrance();
    const [x, , z] = this.o.grid.toWorld(door);
    const g = this.o.grid;
    const half = { w: (g.width * g.cellSize) / 2, d: (g.depth * g.cellSize) / 2 };
    const out = 0.6 * (slot + 1);
    // Outward = away from the floor centre, along the side the door is on.
    if (Math.abs(z) >= half.d - g.cellSize) this.z = z + Math.sign(z || 1) * out;
    else this.x = x + Math.sign(x || 1) * out;
    if (Math.abs(z) >= half.d - g.cellSize) this.x = x;
    else this.z = z;
    this.heading = Math.atan2(x - this.x, z - this.z);
  }

  private tryEnter(): void {
    const crowd = this.o.crowd!;
    const { door } = this.o.grid.entrance();
    const [x, , z] = this.o.grid.toWorld(door);
    if (crowd.clearOfPeople(this.id, x, z, RADIUS_WALKING)) return;
    this.waitingOutside = false;
    this.x = x;
    this.z = z;
    crowd.place(this.id, x, z, { seated: false, priority: 2 });
  }

  /** A* that steers clear of seated colleagues (US3), falling back to the plain grid. */
  private plan(from: Cell, to: Cell, aroundStanding = true): Cell[] | null {
    const crowd = this.o.crowd;
    if (crowd) {
      const p = findPath(avoiding(this.o.grid, crowd.occupiedCells(this.id, this.seat, aroundStanding), [from, to]), from, to);
      if (p) return p;
    }
    return findPath(this.o.grid, from, to);
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
    this.standUp();
    const path = this.plan(from, door);
    if (!path) {
      this.mode = { kind: 'left' };
      this.dispose();
      return;
    }
    this.mode = { kind: 'walking', path, i: 0, then: 'leave-done' };
    this.o.crowd?.setPriority(this.id, 2);
    void now;
  }

  private scheduleBreak(now: number): void {
    this.nextBreakAt = now + this.breakMean + (this.rng() * 2 - 1) * this.breakJitter;
  }

  /** Leave the chair; with a crowd this only succeeds when there is room to stand (no overlap, ever). */
  private standUp(): boolean {
    const crowd = this.o.crowd;
    if (!crowd) return true;
    const a = crowd.get(this.id);
    if (!a?.seated) return true;
    if (crowd.clearOfPeople(this.id, this.x, this.z, RADIUS_WALKING)) return false;
    crowd.setSeated(this.id, false);
    return true;
  }

  private walkTo(target: Cell, then: 'drink' | 'sit' | 'leave-done', now: number): void {
    const from = this.o.grid.toCell(this.x, this.z);
    if (!this.standUp()) return; // someone is right behind the chair: try again next frame
    const path = this.plan(from, target);
    this.blockedFor = 0;
    if (!path || path.length < 2) {
      if (then === 'sit') this.mode = this.atHome();
      else if (then === 'drink') this.mode = { kind: 'acting', clip: 'Yes', until: now + 3000, then: 'return' };
      else {
        this.mode = { kind: 'left' };
        this.dispose();
      }
      return;
    }
    this.mode = { kind: 'walking', path, i: 0, then };
    this.o.crowd?.setPriority(this.id, then === 'drink' ? 1 : 2);
  }

  private startBreak(now: number): void {
    if (!this.standUp()) return;
    const cooler = this.o.grid.approachOf('water_cooler');
    if (cooler && this.rng() < 0.6) this.walkTo(cooler, 'drink', now);
    else this.mode = { kind: 'acting', clip: 'ThumbsUp', until: now + 3500, then: 'sit' };
    this.scheduleBreak(now);
  }

  /** Advance by dt seconds and return the pose to render. */
  tick(dt: number, now = Date.now()): Pose {
    const m = this.mode;
    this.lastNow = now;
    if (this.visual === 'disconnected') return this.pose('Idle', m.kind === 'seated');
    this.takeBumps(now);

    switch (m.kind) {
      case 'seated':
        if (this.visual === 'idle' && now >= this.nextBreakAt) this.startBreak(now);
        return this.pose(this.seatedClip(), this.mode.kind === 'seated');
      case 'lobby':
        return this.pose(this.visual === 'waiting_for_boss' ? 'Wave' : 'Idle', false);
      case 'entering':
      case 'walking': {
        if (this.waitingOutside) {
          this.tryEnter();
          return this.pose('Idle', false);
        }
        // A bump freezes the walk for a moment (FR-018) — the reaction plays, then the walk resumes.
        if (this.reaction && now < this.reaction.until) return this.pose('Idle', false);
        // Shared spots (cooler, lobby) take whoever is close enough once the way is blocked: they queue
        // around it instead of all fighting for the same cell (FR-016 edge case). A seat must be reached.
        const relaxed = m.kind === 'walking' && m.then === 'drink';
        const arrived = this.followPath(m, dt, now, relaxed);
        if (arrived) {
          if (m.kind === 'entering') this.mode = this.atHome();
          else if (m.then === 'drink') this.mode = { kind: 'acting', clip: 'Yes', until: now + 3000, then: 'return' };
          else if (m.then === 'leave-done') {
            this.mode = { kind: 'left' };
            this.dispose();
          } else this.mode = this.atHome();
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

  private takeBumps(now: number): void {
    const crowd = this.o.crowd;
    if (!crowd) return;
    const ev = crowd.takeEvents(this.id).at(-1);
    if (!ev || this.mode.kind === 'seated') return;
    // 0.6–1.0 s: stop, lean back, look at what was bumped (FR-018).
    this.reaction = { kind: ev.kind, from: now, until: now + 600 + this.rng() * 400, towards: Math.atan2(ev.x - this.x, ev.z - this.z), x: ev.x, z: ev.z, seq: ++this.bumpSeq };
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

  private followPath(m: { path: Cell[]; i: number }, dt: number, now: number, relaxed = false): boolean {
    const crowd = this.o.crowd;
    let budget = WALK_SPEED * dt;
    let guard = 0;
    while (budget > 1e-9 && m.i < m.path.length && guard++ < 8) {
      const [tx, , tz] = this.o.grid.toWorld(m.path[m.i]!);
      const dx = tx - this.x;
      const dz = tz - this.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1e-4) {
        m.i++;
        continue;
      }
      if (crowd) {
        const r = crowd.step(this.id, tx, tz, budget, dt, now, this.blockedFor);
        const moved = Math.hypot(r.x - this.x, r.z - this.z);
        if (moved > 1e-6) this.heading = Math.atan2(r.x - this.x, r.z - this.z);
        this.x = r.x;
        this.z = r.z;
        if (Math.hypot(tx - this.x, tz - this.z) < 0.02) {
          m.i++;
          budget -= moved;
          this.blockedFor = 0;
          continue;
        }
        // Slow or stopped: count it; skip a waypoint someone stands on, accept a shared spot from nearby,
        // and after a while look for another way (FR-021).
        if (r.progress < 0.2) {
          this.blockedFor += dt;
          const [gx, , gz] = this.o.grid.toWorld(m.path.at(-1)!);
          if (relaxed && this.blockedFor > QUEUE_AFTER_S && Math.hypot(gx - this.x, gz - this.z) < QUEUE_RADIUS) {
            m.i = m.path.length;
            this.blockedFor = 0;
            break;
          }
          // Only a waypoint we are already next to may be skipped, so the route never cuts across the room.
          if (this.blockedFor > SKIP_WAYPOINT_AFTER_S && m.i < m.path.length - 1 && !this.skipped && Math.hypot(tx - this.x, tz - this.z) < 0.6) {
            m.i++;
            this.skipped = true;
          }
          if (this.blockedFor > REPLAN_AFTER_S) this.replan(m);
        } else {
          this.blockedFor = 0;
          this.skipped = false;
        }
        break;
      }
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

  /** Re-route from where we stand to the same goal; if there is no way, keep waiting (no walking through). */
  private replan(m: { path: Cell[]; i: number }): void {
    this.blockedFor = 0;
    const goal = m.path.at(-1)!;
    const from = this.o.grid.toCell(this.x, this.z);
    const p = this.plan(from, goal, true);
    if (p && p.length > 1) {
      m.path = p;
      m.i = 1;
    }
  }

  private pose(clip: Clip, seated: boolean): Pose {
    const r = this.reaction;
    let reaction: Reaction | null = null;
    if (r && this.lastNow >= r.until) this.reaction = null;
    else if (r) reaction = { kind: r.kind, t: Math.min(1, Math.max(0, (this.lastNow - r.from) / (r.until - r.from))), towards: r.towards, x: r.x, z: r.z, seq: r.seq };
    return { x: this.x, z: this.z, heading: this.heading, clip, seated, reaction };
  }

}
