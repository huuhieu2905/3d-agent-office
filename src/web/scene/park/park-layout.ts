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

/** May a tree stand here for this office? Keeps the lawn, the loop path, the spokes and the kiosk free. */
export function treeAllowed(f: ParkFrame, x: number, z: number): boolean {
  const k = kioskSpot(f);
  if (Math.hypot(x - k.x, z - k.z) < 4) return false;
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
