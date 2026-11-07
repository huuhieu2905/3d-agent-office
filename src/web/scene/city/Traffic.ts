import type { DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from '../park/detail';

// 002 US7 / T085 / FR-042: cars, motorbikes and buses on the ring road, both directions. Each lane has
// one speed and its vehicles start evenly spaced, so nothing ever overlaps (tests/unit/traffic.test.ts).
// Pure: Traffic.tsx draws it.

export type VehicleKind = 'car' | 'moto' | 'bus';

export interface Vehicle {
  kind: VehicleKind;
  lane: number;
  radius: number;
  /** +1 counter-clockwise, −1 clockwise (seen from above). */
  dir: 1 | -1;
  /** Linear speed, m/s. */
  speed: number;
  angle: number;
  color: string;
  /** Motorbikes: rider shirt and helmet colours. */
  rider?: { shirt: string; helmet: string };
}

const LEN: Record<VehicleKind, number> = { car: 4.2, moto: 1.7, bus: 10.5 };
export const vehicleLength = (k: VehicleKind) => LEN[k];

const CAR_COLORS = ['#fffaf0', '#2f80a5', '#c2603a', '#3fae7a', '#f2c14e', '#9a9ca3', '#1f1f22'];
const SHIRTS = ['#ffffff', '#2f80a5', '#c2603a', '#3fae7a', '#f2c94c'];
const HELMETS = ['#f2c14e', '#e0322a', '#ffffff', '#1f6f6a'];

export function createTraffic(seed: number, detail: DetailLevel): Vehicle[] {
  const r = rng(seed * 17 + 3);
  const n = DETAIL[detail].cars; // 4 / 10 / 20
  const lanes: { radius: number; dir: 1 | -1; speed: number; kinds: VehicleKind[] }[] = [
    { radius: ROAD_RADIUS - 0.8, dir: 1, speed: 6.5, kinds: Array.from({ length: Math.max(2, Math.round(n * 0.4)) }, (_, i) => (i === 0 ? 'bus' : 'car')) },
    { radius: ROAD_RADIUS + 0.8, dir: -1, speed: 5.5, kinds: Array.from({ length: Math.max(1, Math.round(n * 0.4)) }, (_, i) => (i === 1 ? 'bus' : 'car')) },
    { radius: ROAD_RADIUS - 1.9, dir: 1, speed: 8, kinds: Array.from({ length: Math.max(2, Math.round(n * 0.45)) }, () => 'moto' as const) },
    { radius: ROAD_RADIUS + 1.9, dir: -1, speed: 7.5, kinds: Array.from({ length: Math.max(2, Math.round(n * 0.45)) }, () => 'moto' as const) },
  ];
  const out: Vehicle[] = [];
  lanes.forEach((L, lane) => {
    const step = (Math.PI * 2) / L.kinds.length;
    const offset = r() * step;
    L.kinds.forEach((kind, i) => {
      out.push({
        kind,
        lane,
        radius: L.radius,
        dir: L.dir,
        speed: L.speed,
        angle: offset + i * step + r() * step * 0.3,
        color: kind === 'bus' ? '#3a9a5a' : CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]!,
        rider: kind === 'moto' ? { shirt: SHIRTS[Math.floor(r() * SHIRTS.length)]!, helmet: HELMETS[Math.floor(r() * HELMETS.length)]! } : undefined,
      });
    });
  });
  return out;
}

export function stepTraffic(vehicles: Vehicle[], dt: number): void {
  for (const v of vehicles) v.angle = (v.angle + (v.dir * v.speed * dt) / v.radius) % (Math.PI * 2);
}
