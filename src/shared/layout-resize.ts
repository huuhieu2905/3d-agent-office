import { DOOR_WIDTH, type OfficeLayout } from './domain';
import { floorSizeValid, minFloorSize, resizeBlockers } from './layout-validation';

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
  return { ok: true, layout: { ...layout, floor: { width, depth }, shell: { ...layout.shell, door } } };
}
