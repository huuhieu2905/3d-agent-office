import { PARK_RADIUS } from './park/detail';
import { onPath, type ParkFrame } from './park/park-layout';

// 004 US3 (research R4-03): walking routes outside the office as world-space polylines — no A* over the
// whole park. Out to the loop path across the open lawn (always tree-free), along the loop the shorter
// way round, then in to the spot. The shared Crowd keeps people apart on the way. Pure for unit tests.

export interface Pt {
  x: number;
  z: number;
}

/** Spacing (m) of the points sampled along the loop path. */
const STEP = 1;
/** How far before a spot the route leaves the straight line from the path (m). */
const LEAD = 1;

/** Parametric angle of the loop-path point closest (roughly) to `p`. */
function pathAngle(f: ParkFrame, p: Pt): number {
  return Math.atan2(p.z / f.rz, p.x / f.rx);
}

function toward(a: Pt, b: Pt, d: number): Pt {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const k = Math.min(1, d / len);
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}

/** Points along the loop from angle a to b, the shorter way round, about STEP metres apart. */
function along(f: ParkFrame, a: number, b: number): Pt[] {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const n = Math.max(1, Math.ceil((Math.abs(d) * (f.rx + f.rz)) / 2 / STEP));
  return Array.from({ length: n + 1 }, (_, i) => onPath(f, a + (d * i) / n));
}

/** Route from `from` to `to`, both outside the office (doorstep, shop spot, park edge). Includes both ends. */
export function outdoorRoute(f: ParkFrame, from: Pt, to: Pt): Pt[] {
  const a = pathAngle(f, from);
  const b = pathAngle(f, to);
  const loop = along(f, a, b);
  const pts: Pt[] = [from, toward(from, loop[0]!, LEAD), ...loop, toward(to, loop.at(-1)!, LEAD), to];
  // Drop points closer than 5 cm to the previous one.
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.z - pts[i - 1]!.z) > 0.05);
}

export function routeLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z);
  return s;
}

/**
 * Way out of the park for someone deleted while outside (spec edge case): along the loop to the nearest
 * straight spoke (kept free of trees), then out along it to just inside the park edge.
 */
export function edgeExit(f: ParkFrame, from: Pt, radius = PARK_RADIUS - 1.5): Pt[] {
  const a = pathAngle(f, from);
  const spoke = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  const loop = along(f, a, spoke);
  const end = { x: Math.round(Math.cos(spoke)) * radius, z: Math.round(Math.sin(spoke)) * radius };
  return [from, toward(from, loop[0]!, LEAD), ...loop, end];
}
