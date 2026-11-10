import { PARK_RADIUS, ROAD_RADIUS, rng } from './detail';

// 002 US4 / T055 / research.md R2-05 (round 4 of the concept feedback): the park reflows around the
// office. An open lawn keeps CLEAR metres free on every side; the loop path is an ellipse through the
// office corners pushed out by PATH_OFFSET; trees come from ONE fixed, seeded set for the whole park and
// are only hidden where the office (plus lawn) or a path now is — resizing never moves a tree.
// Pure so it can be unit-tested (tests/unit/park-layout.test.ts).

/** Open lawn (m) between the office edge and the nearest tree. */
export const CLEAR = 8;
/** Wide enough for four walking/jogging lanes 0.6 m apart (park/walkers.ts). */
export const PATH_WIDTH = 2.4;
/** Path centre-line beyond the office corners (m); keeps ≥ 5 m of lawn up to the path's inner edge. */
const PATH_OFFSET = 6.4;

export interface ParkFrame {
  /** Half size of the office (m). */
  hw: number;
  hd: number;
  /** Path centre-line ellipse radii (m). */
  rx: number;
  rz: number;
}

export function parkFrame(floor: { width: number; depth: number }): ParkFrame {
  const hw = floor.width / 2;
  const hd = floor.depth / 2;
  return { hw, hd, rx: hw * Math.SQRT2 + PATH_OFFSET, rz: hd * Math.SQRT2 + PATH_OFFSET };
}

/** Point on the loop path; `lane` shifts across it (m, + = outward). */
export function onPath(f: ParkFrame, angle: number, lane = 0): { x: number; z: number } {
  return { x: Math.cos(angle) * (f.rx + lane), z: Math.sin(angle) * (f.rz + lane) };
}

/** 1 on the path centre-line, < 1 inside it. */
export function ellipseScale(f: ParkFrame, x: number, z: number): number {
  return Math.hypot(x / f.rx, z / f.rz);
}

export interface TreeSpot {
  x: number;
  z: number;
  s: number;
  rot: number;
}

/** The park's fixed tree set (independent of the office size): uniform over the park disc. */
export function treeCandidates(seed: number, count: number): TreeSpot[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * PARK_RADIUS;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.7 + r() * 0.8, rot: r() * Math.PI };
  });
}

/**
 * The park kiosk café (US7, FR-037): on the lawn just outside the loop, north-west of the office, where
 * the default overview camera sees it.
 */
export function kioskSpot(f: ParkFrame): { x: number; z: number; facing: number } {
  const a = -2.2;
  const p = onPath(f, a, PATH_WIDTH / 2 + 4);
  // Face the office (the centre).
  return { x: p.x, z: p.z, facing: Math.atan2(-p.x, -p.z) };
}

// ---- 004 US3: shops around the park (research R4-04, data-model §5) -----------------------------------

export interface Spot {
  id: string;
  x: number;
  z: number;
  /** Heading (radians, 0 = facing +z) of someone using the spot. */
  facing: number;
}

export type ShopId = 'cafe' | 'grocery' | 'sugarcane' | 'banhmi';
export type ShopKind = 'kiosk' | 'grocery' | 'cart';

export interface ParkShop {
  id: ShopId;
  kind: ShopKind;
  x: number;
  z: number;
  /** rotation-y of the pavilion; its local +z faces the office. */
  facing: number;
  /** Pavilion box in world space (for SiteGrid): centre, half sizes along the pavilion's own axes, rotation. */
  box: { x: number; z: number; hw: number; hd: number; rot: number };
  /** Small tables (blocking circles). */
  tables: { x: number; z: number; r: number }[];
  /** Plastic stools, facing their table. */
  seats: Spot[];
  /** Places to stand in front of the counter. */
  stands: Spot[];
}

/** Pavilion width (m); every park shop uses the kiosk's shape (Shops.tsx `Kiosk`). */
export const SHOP_WIDTH = 4.3;
/** Angle on the loop path, per shop — four diagonals, away from the straight spokes and the exercise group. */
const SHOP_ANGLES: [ShopId, ShopKind, number][] = [
  ['cafe', 'kiosk', -2.2], // same place as the 002 kiosk
  ['grocery', 'grocery', -0.85],
  ['sugarcane', 'cart', 0.85],
  ['banhmi', 'cart', 2.3],
];

function local(o: { x: number; z: number; facing: number }, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(o.facing);
  const s = Math.sin(o.facing);
  return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c };
}

export function parkShops(f: ParkFrame): ParkShop[] {
  // Shop() draws its two tables at x = −0.28·w and 0.18·w, z = 1.7, with w = min(width − 0.3, 6).
  const w = Math.min(SHOP_WIDTH - 0.3, 6);
  const tablesL = [-w * 0.28, w * 0.18];
  return SHOP_ANGLES.map(([id, kind, a]) => {
    const p = onPath(f, a, PATH_WIDTH / 2 + 4);
    const o = { x: p.x, z: p.z, facing: Math.atan2(-p.x, -p.z) };
    const centre = local(o, 0, -1.15);
    const seats: Spot[] = [];
    tablesL.forEach((tx, t) => {
      for (const side of [-1, 1]) {
        const s = local(o, tx + side * 0.5, 1.7);
        // Facing the table: −x side looks along +x (local heading π/2) and vice versa.
        seats.push({ id: `${id}:seat${t}${side < 0 ? 'L' : 'R'}`, x: s.x, z: s.z, facing: o.facing + (side < 0 ? Math.PI / 2 : -Math.PI / 2) });
      }
    });
    const stands: Spot[] = [-0.4, 1.2].map((lx, i) => {
      const s = local(o, lx, 0.85);
      return { id: `${id}:stand${i}`, x: s.x, z: s.z, facing: o.facing + Math.PI };
    });
    return {
      id,
      kind,
      ...o,
      box: { x: centre.x, z: centre.z, hw: SHOP_WIDTH / 2, hd: 1.5, rot: o.facing },
      // r 0.2 (+ the grid's 0.15 m margin) keeps the stools 0.5 m away in walkable cells (T066: a 0.3 m
      // table put stool cells inside the obstacle and people could not get up from them).
      tables: tablesL.map((tx) => ({ ...local(o, tx, 1.7), r: 0.2 })),
      seats,
      stands,
    };
  });
}

/** The trees actually drawn by Trees.tsx (same seed, filter and count), so collisions match what is seen. */
export function visibleTrees(f: ParkFrame, seed: number, count: number): TreeSpot[] {
  return treeCandidates(seed * 31, count * 2)
    .filter((t) => treeAllowed(f, t.x, t.z))
    .slice(0, count);
}

/** May a tree stand here for this office? Keeps the lawn, the loop path, the spokes and the shops free. */
export function treeAllowed(f: ParkFrame, x: number, z: number): boolean {
  const k = kioskSpot(f);
  if (Math.hypot(x - k.x, z - k.z) < 4) return false;
  for (const [, , a] of SHOP_ANGLES) {
    const p = onPath(f, a, PATH_WIDTH / 2 + 4);
    if (Math.hypot(x - p.x, z - p.z) < 4) return false;
  }
  if (Math.abs(x) < f.hw + CLEAR && Math.abs(z) < f.hd + CLEAR) return false;
  const e = ellipseScale(f, x, z);
  const margin = (PATH_WIDTH / 2 + 1.5) / Math.min(f.rx, f.rz);
  if (Math.abs(e - 1) < margin || e < 1) return false;
  // The four straight paths from the loop to the road.
  if (Math.abs(x) < 1.8 || Math.abs(z) < 1.8) return false;
  return Math.hypot(x, z) < PARK_RADIUS;
}

/** Where the exercise group stands: on the lawn just outside the loop, west side. */
export function exerciseSpots(f: ParkFrame, n: number): { x: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const p = onPath(f, Math.PI * (0.9 + 0.05 * i), PATH_WIDTH / 2 + 3 + (i % 2) * 1.2);
    return { x: p.x, z: p.z };
  });
}

/** Straight paths from the loop to the road ring: segments [from, to] along each axis direction. */
export function spokes(f: ParkFrame): { axis: 'x' | 'z'; sign: 1 | -1; from: number; to: number }[] {
  const out: { axis: 'x' | 'z'; sign: 1 | -1; from: number; to: number }[] = [];
  for (const sign of [1, -1] as const) {
    out.push({ axis: 'x', sign, from: f.rx, to: ROAD_RADIUS - 2.4 });
    out.push({ axis: 'z', sign, from: f.rz, to: ROAD_RADIUS - 2.4 });
  }
  return out;
}
