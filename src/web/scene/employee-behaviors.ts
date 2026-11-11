import type { OfficeLayout, PlacedItem, VisualState, WeatherCondition } from '@shared/domain';
import type { Clip } from './character';
import { findPath } from './grid/astar';
import type { Cell } from './grid/grid';
import { avoiding, RADIUS_SEATED, RADIUS_WALKING, type BumpEvent, type Crowd } from './crowd/crowd';
import { sofaOf, sofaSpots, type SpotBook } from './break-spots';
import { edgeExit, outdoorRoute, routeLength, type Pt } from './outdoor-route';
import type { ParkFrame, ParkShop, Spot } from './park/park-layout';
import type { DoorBook } from './doors';

// Per-employee behaviour (FR-012, R15): sit at the assigned desk, act out the real status, and when idle
// do a random break every 5 ± 2 minutes (stretch, or walk to the water cooler and back to the SAME desk).
// 002 US3 (R2-04): the brain decides *where* to go; when a shared Crowd is given, the crowd decides *how*
// far each step may go, so employees never overlap, give way to each other and react to bumps.
// 004 US3 (R4-05, R4-06): with a SpotBook and the park shops, a break may also be a rest on the sofa or a
// trip out of the door to a shop around the park; real work calls everyone back, running.
// Pure logic (no React/three) so it can be unit-tested.

export const BREAK_MEAN_MS = 5 * 60_000;
export const BREAK_JITTER_MS = 2 * 60_000;
const WALK_SPEED = 1.1; // m/s
/** 004 R4-06: running back to the desk when work arrives. */
export const HURRY_SPEED = 2.8;
/** Indoors the run is slower: desks and colleagues are close (keeps cramped offices flowing). */
const HURRY_INDOOR = 2.0;
/** 004 R4-06: only shops this close to the door (m of route), so a recall always takes < 30 s. */
export const MAX_SHOP_ROUTE = 55;
const REST_MIN_MS = 20_000;
const REST_SPREAD_MS = 70_000;
/** Break activity weights (R4-05). */
const WEIGHTS = { stretch: 0.15, water: 0.3, sofa: 0.25, shop: 0.3 } as const;
export type Activity = keyof typeof WEIGHTS;

/** What the brain needs from a navigation grid: OfficeGrid (001–003) or SiteGrid (004, office + park). */
export interface NavGrid {
  readonly width: number;
  readonly widthM: number;
  readonly depthM: number;
  readonly cellSize: number;
  readonly layout: OfficeLayout;
  toWorld(c: Cell): [number, number, number];
  toCell(x: number, z: number): Cell;
  walkable(x: number, z: number): boolean;
  inside(x: number, z: number): boolean;
  neighbours(c: Cell): Cell[];
  canStep(a: Cell, b: Cell): boolean;
  entrance(): { door: Cell; lobby: Cell };
  approachOf(type: PlacedItem['type']): Cell | null;
  /** SiteGrid only. */
  indoorView?(): { width: number; inside(x: number, z: number): boolean; neighbours(c: Cell): Cell[] };
  isIndoorAt?(x: number, z: number): boolean;
  doorstep?(): { x: number; z: number };
}
/** Stuck this long (s) → plan a new route around whoever is in the way (FR-021 allows up to 5 s). */
const REPLAN_AFTER_S = 2;
/** Blocked this long (s) on a waypoint someone stands on → aim at the next one. */
const SKIP_WAYPOINT_AFTER_S = 0.3;
/**
 * 004 (found by the office-life e2e): two people meeting head-on in a narrow aisle can shuffle sideways
 * and back for ever — each small sidestep counts as progress, so `blockedFor` never builds up. If the
 * net movement over this window (ms) stays under JAM_DIST (m), re-plan around everyone nearby.
 */
const JAM_WINDOW_MS = 2000;
const JAM_DIST = 0.3;
/** Blocked this long (s) within QUEUE_RADIUS (m) of a shared spot → use it from here. */
const QUEUE_AFTER_S = 1.5;
const QUEUE_RADIUS = 1.4;
/** Lobby slots are spread out so waiting employees never overlap (0.25 m cells). */
const LOBBY_SPACING = 3;

type Mode =
  | { kind: 'entering'; path: Cell[]; i: number }
  | { kind: 'seated' }
  | { kind: 'lobby' }
  | { kind: 'walking'; path: Cell[]; i: number; then: 'drink' | 'sit' | 'leave-done' | 'go-out' | 'sofa' }
  | { kind: 'acting'; clip: Clip; until: number; then: 'return' | 'sit' }
  | { kind: 'outing'; pts: Pt[]; i: number; then: 'rest' | 'home' | 'leave' }
  | { kind: 'resting'; spot: Spot; pose: 'sit' | 'lie' | 'stand'; until: number; outside: boolean }
  | { kind: 'left' };

/** Where the current break is heading (sofa / shop), decided when the break starts. */
interface Plan {
  spot: Spot;
  pose: 'sit' | 'lie' | 'stand';
  /** Sofa: the walkable cell in front of it, where the employee stands up again. */
  approach?: Cell;
}

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
  /** 004 FR-029: holding an umbrella (walking back in the rain). */
  umbrella?: boolean;
  /** 004 R4-06: 1 = walking, > 1 = running back. */
  speedScale?: number;
}

export interface BrainOptions {
  grid: NavGrid;
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
  /** 004 US3: shared break-spot bookings. Without it, breaks are the 001–003 ones (stretch / water). */
  spots?: SpotBook;
  /** 004 US3: the park shops and the park frame (needs a SiteGrid to leave the office). */
  shops?: ParkShop[];
  frame?: ParkFrame;
  /** 008: office doors — a closed one is opened before walking through it. */
  doors?: DoorBook;
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
  private breakMean: number;
  private breakJitter: number;
  /** New employee queueing outside the door until the doorway is free (US3). */
  private waitingOutside = false;
  /** Clock of the current tick (ms), so poses and reactions use the caller's time. */
  private lastNow = 0;
  /** 004: current walking speed (m/s); HURRY_SPEED while called back to work. */
  private speed = WALK_SPEED;
  /** 004: what the current break is (for test hooks / debugging). */
  private activityKind: Activity | null = null;
  private plan_: Plan | null = null;
  private rainy = false;
  private umbrella = false;
  /** Walking back after a recall: keeps moving even while disconnected (spec edge case). */
  private returning = false;
  /** Jam detector: where and when the current window started. */
  private jam = { x: 0, z: 0, at: 0 };
  /** 008: the office door this employee asked to open (released once it is behind them). */
  private heldDoor: string | null = null;

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

  /** Someone stands too close to the home spot to sit down there yet. */
  private seatTaken(): boolean {
    const crowd = this.o.crowd;
    if (!crowd || !this.seat) return false;
    const [x, , z] = this.o.grid.toWorld(this.homeCell());
    return !!crowd.clearOfPeople(this.id, x, z, RADIUS_SEATED);
  }

  /** Test hooks (004 U4-4): shorten the break interval and reschedule the next break. */
  setBreakInterval(meanMs: number, now = Date.now()): void {
    this.breakMean = meanMs;
    this.breakJitter = meanMs / 2;
    this.nextBreakAt = now + this.rng() * meanMs;
  }

  /** 004: the current break activity, or null at the desk. */
  get activity(): Activity | null {
    return this.activityKind;
  }

  /** 004: outside the office (park, shops). */
  get outside(): boolean {
    return this.o.grid.isIndoorAt ? !this.o.grid.isIndoorAt(this.x, this.z) : false;
  }

  /** Remove from the shared crowd and give back any booked spot (component unmount). */
  dispose(): void {
    this.o.crowd?.remove(this.id);
    this.o.spots?.release(this.id);
    this.o.doors?.releaseAll(this.id);
  }

  /** A* grid: indoor cells only when the grid also covers the park (SiteGrid). */
  private nav() {
    return this.o.grid.indoorView ? this.o.grid.indoorView() : this.o.grid;
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
    this.endBreak();
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
    const half = { w: g.widthM / 2, d: g.depthM / 2 };
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
  private plan(from: Cell, to: Cell, aroundStanding = true, aroundEveryone = false): Cell[] | null {
    const crowd = this.o.crowd;
    const nav = this.nav();
    if (crowd) {
      const p = findPath(avoiding(nav, crowd.occupiedCells(this.id, this.seat, aroundStanding, aroundEveryone), [from, to]), from, to);
      if (p) return p;
    }
    return findPath(nav, from, to);
  }

  /** Desk changed (drag & drop or new assignment): walk to the new seat. */
  setSeat(seat: Cell | null, now = Date.now()): void {
    const same = (a: Cell | null, b: Cell | null) => (a && b ? a.x === b.x && a.z === b.z : a === b);
    if (same(seat, this.seat)) return;
    this.seat = seat;
    if (this.mode.kind === 'left') return;
    if (this.onBreak()) return this.recall({}, now);
    this.walkTo(this.homeCell(), 'sit', now);
  }

  setVisual(v: VisualState, now = Date.now()): void {
    const prev = this.visual;
    this.visual = v;
    if (v === prev) return;
    // Real work always wins over a break: go straight back to the desk (R5, Constitution I) — running
    // when the break took them to the sofa or out to the park (004 FR-023).
    if (v !== 'idle' && v !== 'disconnected' && this.onBreak()) {
      this.recall({ hurry: true }, now);
    }
    // 004 FR-028: losing the App connection ends a sofa rest or an outing too (walk back, then stand still).
    if (v === 'disconnected' && this.onBreak() && this.mode.kind !== 'walking' && this.mode.kind !== 'acting') this.recall({}, now);
    if (v === 'idle' && prev !== 'idle') this.scheduleBreak(now);
  }

  leave(now = Date.now()): void {
    // 004 edge case: deleted while out in the park — walk off to the park edge, never back inside.
    if (this.outside && this.o.frame) {
      this.releaseSpot();
      if (this.mode.kind === 'resting') this.o.crowd?.setSeated(this.id, false);
      this.mode = { kind: 'outing', pts: edgeExit(this.o.frame, { x: this.x, z: this.z }), i: 0, then: 'leave' };
      this.o.crowd?.setPriority(this.id, 2);
      return;
    }
    if (this.mode.kind === 'resting') this.leaveSpot();
    this.releaseSpot();
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

  private walkTo(target: Cell, then: 'drink' | 'sit' | 'leave-done' | 'go-out' | 'sofa', now: number): void {
    const from = this.o.grid.toCell(this.x, this.z);
    if (!this.standUp()) return; // someone is right behind the chair: try again next frame
    const path = this.plan(from, target);
    this.blockedFor = 0;
    if (!path || path.length < 2) {
      if (then === 'sit') this.mode = this.atHome();
      else if (then === 'drink') this.mode = { kind: 'acting', clip: 'Drinking', until: now + 3000, then: 'return' };
      else if (then === 'go-out') this.goOut(now);
      else if (then === 'sofa') this.sitDown(now);
      else {
        this.mode = { kind: 'left' };
        this.dispose();
      }
      return;
    }
    this.mode = { kind: 'walking', path, i: 0, then };
    this.o.crowd?.setPriority(this.id, then === 'sit' || then === 'leave-done' ? 2 : 1);
  }

  private startBreak(now: number): void {
    if (!this.standUp()) return;
    const cooler = this.o.grid.approachOf('water_cooler');
    if (!this.o.spots) {
      // 001–003 breaks: stretch, or a drink at the cooler (same random draws as before).
      if (cooler && this.rng() < 0.6) this.walkTo(cooler, 'drink', now);
      else this.mode = { kind: 'acting', clip: 'ThumbsUp', until: now + 3500, then: 'sit' };
      this.scheduleBreak(now);
      return;
    }
    this.scheduleBreak(now);
    // 004 R4-05: pick among the activities available right now, by weight.
    const options: [Activity, number][] = [['stretch', WEIGHTS.stretch]];
    if (cooler) options.push(['water', WEIGHTS.water]);
    if (this.sofaChoices().length) options.push(['sofa', WEIGHTS.sofa]);
    if (this.shopChoices().length) options.push(['shop', WEIGHTS.shop]);
    let pick = this.rng() * options.reduce((s, [, w]) => s + w, 0);
    const choice = options.find(([, w]) => (pick -= w) < 0)?.[0] ?? 'stretch';
    this.activityKind = choice;
    if (choice === 'water' && cooler) return this.walkTo(cooler, 'drink', now);
    if (choice === 'sofa' && this.bookSofa()) return this.walkTo(this.plan_!.approach!, 'sofa', now);
    if (choice === 'shop' && this.bookShop()) return this.walkTo(this.o.grid.entrance().door, 'go-out', now);
    this.activityKind = 'stretch';
    this.mode = { kind: 'acting', clip: 'ThumbsUp', until: now + 3500, then: 'sit' };
  }

  // ---- 004 US3: sofa rests and shop trips ----------------------------------------------------------

  /** Free sofa seats (one seat to sit, both seats of a sofa to lie down). */
  private sofaChoices(): { ids: string[]; spot: Spot; pose: 'sit' | 'lie' }[] {
    const spots = this.o.spots!;
    const all = sofaSpots(this.o.grid.layout);
    const out: { ids: string[]; spot: Spot; pose: 'sit' | 'lie' }[] = [];
    for (const s of all) if (spots.isFree(s.id)) out.push({ ids: [s.id], spot: s, pose: 'sit' });
    const bySofa = new Map<string, Spot[]>();
    for (const s of all) bySofa.set(sofaOf(s.id), [...(bySofa.get(sofaOf(s.id)) ?? []), s]);
    for (const pair of bySofa.values()) {
      if (pair.length === 2 && pair.every((s) => spots.isFree(s.id))) {
        const [a, b] = pair as [Spot, Spot];
        out.push({ ids: [a.id, b.id], spot: { id: a.id, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, facing: a.facing }, pose: 'lie' });
      }
    }
    return out.filter((c) => !!this.approachFor(c.spot));
  }

  /** Nearest walkable indoor cell within 1.2 m of a point (in front of a sofa). */
  private approachFor(p: { x: number; z: number }): Cell | null {
    const g = this.o.grid;
    const c = g.toCell(p.x, p.z);
    let best: Cell | null = null;
    let bestD = Infinity;
    const r = Math.ceil(1.2 / g.cellSize);
    const nav = this.nav();
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const n = { x: c.x + dx, z: c.z + dz };
        if (!nav.inside(n.x, n.z) || !g.walkable(n.x, n.z)) continue;
        const [wx, , wz] = g.toWorld(n);
        const d = Math.hypot(wx - p.x, wz - p.z);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
    return best;
  }

  private bookSofa(): boolean {
    const choices = this.sofaChoices();
    const lie = choices.filter((c) => c.pose === 'lie');
    const sit = choices.filter((c) => c.pose === 'sit');
    const pool = lie.length && (this.rng() < 0.4 || !sit.length) ? lie : sit;
    const c = pool[Math.floor(this.rng() * pool.length)];
    if (!c || !this.o.spots!.reserve(this.id, ...c.ids)) return false;
    this.plan_ = { spot: c.spot, pose: c.pose, approach: this.approachFor(c.spot)! };
    return true;
  }

  /** Free shop spots reachable within MAX_SHOP_ROUTE, unless it rains or enough people are out already. */
  private shopChoices(): { spot: Spot; pose: 'sit' | 'stand' }[] {
    const { spots, shops, frame } = this.o;
    const doorstep = this.o.grid.doorstep?.();
    if (!spots || !shops || !frame || !doorstep || this.rainy) return [];
    if (spots.outsideCount >= spots.outingSlots) return [];
    const out: { spot: Spot; pose: 'sit' | 'stand' }[] = [];
    for (const shop of shops) {
      if (routeLength(outdoorRoute(frame, doorstep, shop)) > MAX_SHOP_ROUTE) continue;
      for (const s of shop.seats) if (spots.isFree(s.id)) out.push({ spot: s, pose: 'sit' });
      for (const s of shop.stands) if (spots.isFree(s.id)) out.push({ spot: s, pose: 'stand' });
    }
    return out;
  }

  private bookShop(): boolean {
    const choices = this.shopChoices();
    const seats = choices.filter((c) => c.pose === 'sit');
    const stands = choices.filter((c) => c.pose === 'stand');
    const pool = seats.length && (this.rng() < 0.7 || !stands.length) ? seats : stands;
    const c = pool[Math.floor(this.rng() * pool.length)];
    if (!c || !this.o.spots!.tryOuting(this.id)) return false;
    if (!this.o.spots!.reserve(this.id, c.spot.id)) {
      this.o.spots!.endOuting(this.id);
      return false;
    }
    this.plan_ = { spot: c.spot, pose: c.pose };
    return true;
  }

  /** At the door cell: out to the doorstep, then along the park to the booked shop spot. */
  private goOut(now: number): void {
    const p = this.plan_;
    const doorstep = this.o.grid.doorstep?.();
    if (!p || !doorstep || !this.o.frame) return this.recall({}, now);
    this.mode = { kind: 'outing', pts: [doorstep, ...outdoorRoute(this.o.frame, doorstep, p.spot).slice(1)], i: 0, then: 'rest' };
  }

  /** In front of the sofa (or at the shop spot): sit / lie / stand there for 20–90 s. */
  private sitDown(now: number): void {
    const p = this.plan_;
    if (!p) return this.recall({}, now);
    const outside = this.outside;
    this.x = p.spot.x;
    this.z = p.spot.z;
    this.heading = p.spot.facing;
    // A rest spot is a seat: others walk around it like around someone at a desk.
    this.o.crowd?.place(this.id, this.x, this.z, { seated: p.pose !== 'stand', priority: 0 });
    this.mode = { kind: 'resting', spot: p.spot, pose: p.pose, until: now + REST_MIN_MS + this.rng() * REST_SPREAD_MS, outside };
  }

  /** Get up from a sofa (back to the cell in front of it). Returns false when someone stands right there. */
  private leaveSpot(): boolean {
    const m = this.mode;
    if (m.kind !== 'resting') return true;
    if (!m.outside && this.plan_?.approach) {
      const [x, , z] = this.o.grid.toWorld(this.plan_.approach);
      if (this.o.crowd?.clearOfPeople(this.id, x, z, RADIUS_WALKING)) return false;
      this.x = x;
      this.z = z;
      this.o.crowd?.place(this.id, x, z, { seated: false });
      return true;
    }
    // Getting up from a stool takes more room: wait until nobody is that close (no overlap, T066).
    return this.standUp();
  }

  private releaseSpot(): void {
    this.o.spots?.release(this.id);
  }

  private endBreak(): void {
    this.releaseSpot();
    this.plan_ = null;
    this.activityKind = null;
    this.speed = WALK_SPEED;
    this.umbrella = false;
    this.returning = false;
  }

  /** On a break that a call to work should cut short. */
  private onBreak(): boolean {
    const m = this.mode;
    if (m.kind === 'acting' || m.kind === 'resting') return true;
    if (m.kind === 'outing') return m.then !== 'leave';
    // Walking back to the desk counts too: a recall re-plans from where they are (as in 001–003).
    if (m.kind === 'walking') return m.then !== 'leave-done';
    return false;
  }

  /**
   * 004: end the break and go back to the desk — running when work arrived (FR-023), under an umbrella
   * when it started to rain (FR-029). Outside, walk back to the door first; nobody walks through walls.
   */
  recall(opts: { hurry?: boolean; umbrella?: boolean } = {}, now = Date.now()): void {
    const m = this.mode;
    if (m.kind === 'left' || (m.kind === 'walking' && m.then === 'leave-done') || (m.kind === 'outing' && m.then === 'leave')) return;
    // Running is 004 behaviour (with break spots); without them a recall walks, as in 001–003.
    if (opts.hurry && this.o.spots) this.speed = HURRY_SPEED;
    if (opts.umbrella) this.umbrella = true;
    if (!this.onBreak() && !(m.kind === 'outing' && m.then === 'home')) return;
    this.returning = true;
    if (m.kind === 'resting' && !this.leaveSpot()) return; // try again next frame (setVisual / tick)
    this.o.spots?.releaseSpots(this.id);
    if (this.outside && this.o.frame && this.o.grid.doorstep) {
      if (m.kind === 'outing' && m.then === 'home') return; // already on the way
      const doorstep = this.o.grid.doorstep();
      const [dx, , dz] = this.o.grid.toWorld(this.o.grid.entrance().door);
      this.mode = { kind: 'outing', pts: [...outdoorRoute(this.o.frame, { x: this.x, z: this.z }, doorstep), { x: dx, z: dz }], i: 0, then: 'home' };
      this.o.crowd?.setPriority(this.id, 2);
      return;
    }
    this.walkTo(this.homeCell(), 'sit', now);
  }

  /** 004 FR-029: rain or a storm sends everyone outside back in under an umbrella; no new trips out. */
  setWeather(c: WeatherCondition, now = Date.now()): void {
    this.rainy = c === 'rain' || c === 'storm';
    if (this.rainy && this.outside) this.recall({ hurry: true, umbrella: true }, now);
  }

  /** Follow world-space points (outdoors) through the crowd; returns true on arrival. */
  private followPts(m: { pts: Pt[]; i: number }, dt: number, now: number): boolean {
    const crowd = this.o.crowd;
    let budget = this.speed * dt;
    let guard = 0;
    while (budget > 1e-9 && m.i < m.pts.length && guard++ < 8) {
      const t = m.pts[m.i]!;
      const dist = Math.hypot(t.x - this.x, t.z - this.z);
      if (dist < 0.02) {
        m.i++;
        continue;
      }
      if (!crowd) {
        const k = Math.min(1, budget / dist);
        this.heading = Math.atan2(t.x - this.x, t.z - this.z);
        this.x += (t.x - this.x) * k;
        this.z += (t.z - this.z) * k;
        budget -= Math.min(budget, dist);
        continue;
      }
      const r = crowd.step(this.id, t.x, t.z, budget, dt, now, this.blockedFor);
      const moved = Math.hypot(r.x - this.x, r.z - this.z);
      if (moved > 1e-6) this.heading = Math.atan2(r.x - this.x, r.z - this.z);
      this.x = r.x;
      this.z = r.z;
      if (Math.hypot(t.x - this.x, t.z - this.z) < 0.05) {
        m.i++;
        budget -= moved;
        this.blockedFor = 0;
        continue;
      }
      const last = m.i === m.pts.length - 1;
      // Close enough to a stool / standing spot: sit down from here rather than shuffle for the last cm.
      if (last && Math.hypot(t.x - this.x, t.z - this.z) < 0.15) {
        m.i++;
        this.blockedFor = 0;
        break;
      }
      if (r.progress < 0.2) {
        this.blockedFor += dt;
        // Outdoors there are no dead ends: skip a blocked waypoint; accept the goal from close by.
        if (!last && this.blockedFor > SKIP_WAYPOINT_AFTER_S * 3) {
          m.i++;
          this.blockedFor = 0;
        } else if (last && this.blockedFor > QUEUE_AFTER_S && dist < QUEUE_RADIUS) {
          m.i = m.pts.length;
          this.blockedFor = 0;
        }
      } else this.blockedFor = 0;
      break;
    }
    return m.i >= m.pts.length;
  }

  /** Advance by dt seconds and return the pose to render. */
  tick(dt: number, now = Date.now()): Pose {
    const m = this.mode;
    this.lastNow = now;
    // Disconnected: freeze, unless walking back from a break (004 FR-028 — back to the desk first).
    if (this.visual === 'disconnected' && !this.returning) return this.pose('Idle', m.kind === 'seated');
    this.takeBumps(now);
    if (this.heldDoor && m.kind !== 'entering' && m.kind !== 'walking') this.releaseDoor();
    // A recall that could not get up from the sofa last frame (someone in front): try again.
    if (this.returning && m.kind === 'resting') this.recall({}, now);

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
        // 008: a closed office door ahead — stop, open it, then walk on (FR-002).
        if (this.waitAtDoor(m)) return this.pose('Idle', false);
        const relaxed = m.kind === 'walking' && m.then === 'drink';
        const arrived = this.followPath(m, dt, now, relaxed);
        if (!arrived && this.o.crowd) this.checkJam(m, now);
        if (arrived) {
          // Sit down only when nobody stands right at the seat (T066): sitting is final for the crowd.
          if ((m.kind === 'entering' || m.then === 'sit') && this.seatTaken()) return this.pose('Idle', false);
          if (m.kind === 'entering') this.mode = this.atHome();
          else if (m.then === 'drink') this.mode = { kind: 'acting', clip: 'Drinking', until: now + 3000, then: 'return' };
          else if (m.then === 'go-out') this.goOut(now);
          else if (m.then === 'sofa') this.sitDown(now);
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
      case 'outing': {
        if (this.reaction && now < this.reaction.until) return this.pose('Idle', false);
        const arrived = this.followPts(m, dt, now);
        if (!arrived && this.o.crowd) this.checkOutdoorJam(m, now);
        if (arrived) {
          if (m.then === 'rest') this.sitDown(now);
          else if (m.then === 'leave') {
            this.mode = { kind: 'left' };
            this.dispose();
          } else {
            // Back inside at the door cell: put the umbrella away, then A* to the desk.
            this.umbrella = false;
            this.o.spots?.endOuting(this.id);
            this.walkTo(this.homeCell(), 'sit', now);
          }
        }
        return this.pose('Walking', false);
      }
      case 'resting':
        if (now >= m.until) this.recall({}, now);
        return this.pose(m.pose === 'lie' ? 'Lying' : m.pose === 'sit' ? 'Resting' : 'Drinking', m.pose === 'sit');
      case 'left':
        return this.pose('Idle', false);
    }
  }

  /**
   * 008 (research R8-02): look at the next few steps of the path; if one crosses an office door within
   * 0.6 m, hold the door open and wait while it is not open yet. A door that is behind us is released.
   * Waiting does not count as being blocked (no skip / re-plan around a closing door).
   */
  private waitAtDoor(m: { path: Cell[]; i: number }): boolean {
    const doors = this.o.doors;
    if (!doors) return false;
    let ahead: string | null = null;
    let px = this.x;
    let pz = this.z;
    for (let k = m.i; k < Math.min(m.path.length, m.i + 4) && !ahead; k++) {
      const [qx, , qz] = this.o.grid.toWorld(m.path[k]!);
      const id = doors.doorBetween(px, pz, qx, qz);
      if (id && doors.doorNear(this.x, this.z, 0.6) === id) ahead = id;
      px = qx;
      pz = qz;
    }
    if (this.heldDoor && this.heldDoor !== ahead) this.releaseDoor();
    if (!ahead) return false;
    doors.request(ahead, this.id);
    this.heldDoor = ahead;
    if (doors.isOpen(ahead)) return false;
    const [tx, , tz] = this.o.grid.toWorld(m.path[m.i] ?? m.path.at(-1)!);
    if (Math.hypot(tx - this.x, tz - this.z) > 1e-4) this.heading = Math.atan2(tx - this.x, tz - this.z);
    return true;
  }

  private releaseDoor(): void {
    if (this.heldDoor) this.o.doors?.release(this.heldDoor, this.id);
    this.heldDoor = null;
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
    let budget = Math.min(this.speed, HURRY_INDOOR) * dt;
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

  /**
   * Outdoors (T066): two people meeting head-on in the doorway or on the loop path can block each other for
   * good — there is no A* to re-plan. When the net movement stays under JAM_DIST for JAM_WINDOW_MS, step
   * aside: insert a waypoint 0.9 m to the left (else right) of the way ahead, on free ground away from people.
   */
  private checkOutdoorJam(m: { pts: Pt[]; i: number }, now: number): void {
    if (Math.hypot(this.x - this.jam.x, this.z - this.jam.z) > JAM_DIST || now < this.jam.at) {
      this.jam = { x: this.x, z: this.z, at: now };
      return;
    }
    if (now - this.jam.at < JAM_WINDOW_MS) return;
    this.jam = { x: this.x, z: this.z, at: now };
    const t = m.pts[m.i];
    if (!t) return;
    const len = Math.hypot(t.x - this.x, t.z - this.z) || 1;
    const px = -(t.z - this.z) / len;
    const pz = (t.x - this.x) / len;
    const g = this.o.grid;
    for (const side of [1, -1]) {
      for (const d of [0.9, 0.6]) {
        const s = { x: this.x + px * side * d, z: this.z + pz * side * d };
        const c = g.toCell(s.x, s.z);
        if (!g.walkable(c.x, c.z)) continue;
        if (this.o.crowd!.clearOfPeople(this.id, s.x, s.z, RADIUS_WALKING)) continue;
        m.pts.splice(m.i, 0, s);
        this.blockedFor = 0;
        return;
      }
    }
  }

  /** Net movement too small for too long (head-on shuffle): re-plan around everyone, moving or not. */
  private checkJam(m: { path: Cell[]; i: number; then?: string }, now: number): void {
    if (Math.hypot(this.x - this.jam.x, this.z - this.jam.z) > JAM_DIST || now < this.jam.at) {
      this.jam = { x: this.x, z: this.z, at: now };
      return;
    }
    if (now - this.jam.at < JAM_WINDOW_MS) return;
    this.jam = { x: this.x, z: this.z, at: now };
    // Queueing at the water cooler: drink from here (the shared spot is taken by the people in front).
    if (m.then === 'drink') {
      const [gx, , gz] = this.o.grid.toWorld(m.path.at(-1)!);
      if (Math.hypot(gx - this.x, gz - this.z) < QUEUE_RADIUS) {
        m.i = m.path.length;
        return;
      }
    }
    const crowd = this.o.crowd!;
    const nav = this.nav();
    const from = this.o.grid.toCell(this.x, this.z);
    const goal = m.path.at(-1)!;
    const p = findPath(avoiding(nav, crowd.occupiedCells(this.id, this.seat, true, true), [from, goal]), from, goal);
    this.blockedFor = 0;
    if (p && p.length > 1) {
      m.path = p;
      m.i = 1;
      return;
    }
    // No way around (the aisle is the person): step aside into a free cell next to the way ahead (T066).
    const t = m.path[m.i] ?? goal;
    const [tx, , tz] = this.o.grid.toWorld(t);
    const len = Math.hypot(tx - this.x, tz - this.z) || 1;
    const px = -(tz - this.z) / len;
    const pz = (tx - this.x) / len;
    for (const side of [1, -1])
      for (const d of [0.75, 0.5]) {
        const c = this.o.grid.toCell(this.x + px * side * d, this.z + pz * side * d);
        if (!nav.inside(c.x, c.z) || !this.o.grid.walkable(c.x, c.z)) continue;
        const [cx, , cz] = this.o.grid.toWorld(c);
        if (crowd.clearOfPeople(this.id, cx, cz, RADIUS_WALKING)) continue;
        m.path.splice(m.i, 0, c);
        return;
      }
  }

  /** Re-route from where we stand to the same goal; if there is no way, keep waiting (no walking through). */
  private replan(m: { path: Cell[]; i: number }, aroundEveryone = false): void {
    this.blockedFor = 0;
    const goal = m.path.at(-1)!;
    const from = this.o.grid.toCell(this.x, this.z);
    const p = this.plan(from, goal, true, aroundEveryone);
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
    const umbrella = this.umbrella && this.outside;
    return { x: this.x, z: this.z, heading: this.heading, clip, seated, reaction, umbrella, speedScale: this.speed / WALK_SPEED };
  }

}
