import { DOOR_WIDTH, type OfficeLayout } from './domain';
import { floorSizeValid, minFloorSize, resizeBlockers } from './layout-validation';
import { CATALOG, CELL, isWallMounted } from './catalog';

// 002 US4 / R2-05: change the office size. Anchored at the north-west corner, so item positions never
// change; the glass façade stays north. Shrinking is refused while furniture would end up outside the
// floor (or without a 0.5 m walkway), and the caller gets the items in the way (FR-024).

export type ResizeResult =
  | { ok: true; layout: OfficeLayout }
  | { ok: false; reason: 'limits' }
  | { ok: false; reason: 'blocked'; blockers: string[]; min: { width: number; depth: number } };

export function resizeLayout(layout: OfficeLayout, width: number, depth: number): ResizeResult {
  if (!floorSizeValid(width) || !floorSizeValid(depth)) return { ok: false, reason: 'limits' };
  const blockers = resizeBlockers(layout, width, depth);
  if (blockers.length) {
    const m = minFloorSize(layout);
    return { ok: false, reason: 'blocked', blockers, min: { width: m.width, depth: m.depth } };
  }
  const { side, offset } = layout.shell.door;
  const sideLen = side === 'south' ? width : depth;
  const door = { side, offset: Math.min(Math.max(0, offset), sideLen - DOOR_WIDTH) };
  // 007: frames on the east / south outer wall move with that wall (and slide back along it if the wall got
  // shorter). They are never dropped here; one that now overlaps another or the door shows up in validation.
  const { width: W, depth: D } = layout.floor;
  const items = layout.items.map((it) => {
    if (!isWallMounted(it.type)) return it;
    const len = CATALOG[it.type].footprint.w * CELL;
    if (it.rotation === 270 && Math.abs(it.pos.x - W) < 1e-6) return { ...it, pos: { x: width, z: Math.min(it.pos.z, depth - len) } };
    if (it.rotation === 180 && Math.abs(it.pos.z - D) < 1e-6) return { ...it, pos: { x: Math.min(it.pos.x, width - len), z: depth } };
    if (it.rotation === 90 && Math.abs(it.pos.x) < 1e-6) return { ...it, pos: { x: 0, z: Math.min(it.pos.z, depth - len) } };
    return it;
  });
  return { ok: true, layout: { ...layout, floor: { width, depth }, shell: { ...layout.shell, door }, items } };
}
