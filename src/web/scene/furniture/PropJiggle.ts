import type { OfficeLayout } from '@shared/domain';
import { footprintRect } from '@shared/catalog';

// 002 US3 / T046 / data-model §6: light props (chairs, small plants) wobble when an employee bumps into
// them — a damped spring on the *rendered* transform only. The saved layout never changes (FR-019).

const LIGHT = new Set(['chair', 'plant']);
const DURATION_MS = 800;
const kicks = new Map<string, { at: number; dirX: number; dirZ: number }>();

/** Nudge the light prop nearest to a bump point (floor metres), if one is within reach. */
export function kickNearest(layout: OfficeLayout, x: number, z: number, fromX: number, fromZ: number, now = performance.now()): string | null {
  let best: { id: string; d: number } | null = null;
  for (const it of layout.items) {
    if (!LIGHT.has(it.type)) continue;
    const r = footprintRect(it);
    const d = Math.hypot((r.x0 + r.x1) / 2 - x, (r.z0 + r.z1) / 2 - z);
    if (d < 0.8 && (!best || d < best.d)) best = { id: it.id, d };
  }
  if (!best) return null;
  const len = Math.hypot(x - fromX, z - fromZ) || 1;
  kicks.set(best.id, { at: now, dirX: (x - fromX) / len, dirZ: (z - fromZ) / len });
  return best.id;
}

/** Current wobble of an item: a small push away from the bump plus a tilt, decaying to zero. */
export function jiggleOf(id: string, now = performance.now()): { dx: number; dz: number; tilt: number } | null {
  const k = kicks.get(id);
  if (!k) return null;
  const t = (now - k.at) / DURATION_MS;
  if (t >= 1) {
    kicks.delete(id);
    return null;
  }
  const amp = Math.exp(-4 * t) * Math.sin(t * Math.PI * 5);
  return { dx: k.dirX * 0.04 * amp, dz: k.dirZ * 0.04 * amp, tilt: 0.08 * amp };
}
