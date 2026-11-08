import { rng } from './detail';
import { onPath, type ParkFrame } from './park-layout';

// 002 T084/T096: walkers and joggers on the park loop. Each direction of walking and of jogging has its
// own lane and one speed, and people in a lane start evenly spaced — so nobody ever walks through anybody
// without needing the office crowd solver. Lanes are LANE_GAP apart, more than two body widths.
// Pure (tests/unit/walkers.test.ts); park/Ambient.tsx draws it.

export type WalkKind = 'walk' | 'jog';
/** Body width of a park figure (shoulders and arms), metres. */
export const BODY_RADIUS = 0.28;
export const LANE_GAP = 0.6;

export const LANES: { kind: WalkKind; lane: number; dir: 1 | -1; speed: number }[] = [
  { kind: 'walk', lane: -LANE_GAP / 2, dir: -1, speed: 1.1 },
  { kind: 'walk', lane: LANE_GAP / 2, dir: 1, speed: 1.0 },
  { kind: 'jog', lane: -LANE_GAP * 1.5, dir: 1, speed: 2.5 },
  { kind: 'jog', lane: LANE_GAP * 1.5, dir: -1, speed: 2.3 },
];

export interface WalkerState {
  kind: WalkKind;
  lane: number;
  dir: 1 | -1;
  speed: number;
  angle: number;
}

export function createWalkers(perLane: number, seed: number): WalkerState[] {
  const r = rng(seed * 13 + 7);
  return LANES.flatMap((L) =>
    Array.from({ length: perLane }, (_, i) => ({ kind: L.kind, lane: L.lane, dir: L.dir, speed: L.speed, angle: (i / perLane) * Math.PI * 2 + r() * 0.5 / perLane })),
  );
}

export function stepWalker(frame: ParkFrame, w: WalkerState, dt: number): void {
  w.angle += (w.dir * w.speed * dt) / ((frame.rx + frame.rz) / 2);
}

/** Position on the loop and the heading of travel (characters face +z). */
export function walkerPose(frame: ParkFrame, w: WalkerState): { x: number; z: number; heading: number } {
  const p = onPath(frame, w.angle, w.lane);
  const tx = -Math.sin(w.angle) * frame.rx * w.dir;
  const tz = Math.cos(w.angle) * frame.rz * w.dir;
  return { x: p.x, z: p.z, heading: Math.atan2(tx, tz) };
}
