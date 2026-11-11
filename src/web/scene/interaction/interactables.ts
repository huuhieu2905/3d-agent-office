import type { OfficeLayout, PlacedItem } from '@shared/domain';
import { footprintRect } from '@shared/catalog';

// 004 US4 (research R4-08): things the first-person user can use — wall screens, sofas, the water cooler,
// plants — and which one is under the crosshair. The main door is not here: it opens by itself (FR-034).
// 008: office doors are — `E` opens or closes them.
// Pure (no React/three) for unit tests.

export type InteractableType = 'wall_screen' | 'sofa' | 'water_cooler' | 'plant' | 'office_door';

export interface Interactable {
  itemId: string;
  type: InteractableType;
  /** World position of the part you look at. */
  x: number;
  y: number;
  z: number;
  /** Hint text after "E — ". */
  action: string;
}

const HEIGHT: Record<InteractableType, number> = { wall_screen: 1.6, sofa: 0.45, water_cooler: 0.95, plant: 0.75, office_door: 1.1 };

function actionFor(type: InteractableType, on: boolean): string {
  switch (type) {
    case 'wall_screen':
      return on ? 'Turn screen off' : 'Turn screen on';
    case 'sofa':
      return 'Sit · Shift+E — Lie down';
    case 'water_cooler':
      return 'Drink water';
    case 'plant':
      return 'Water the plant';
    case 'office_door':
      return on ? 'Close door' : 'Open door';
  }
}

/** Hint for an office door in its current state (008). */
export const doorAction = (open: boolean): string => actionFor('office_door', open);

export function buildInteractables(layout: OfficeLayout, screensOff: readonly string[] = []): Interactable[] {
  // Screens are on unless switched off (Settings.screensOff).
  const out: Interactable[] = [];
  for (const it of layout.items as PlacedItem[]) {
    if (!(it.type in HEIGHT)) continue;
    const type = it.type as InteractableType;
    const r = footprintRect(it);
    out.push({
      itemId: it.id,
      type,
      x: (r.x0 + r.x1) / 2 - layout.floor.width / 2,
      y: HEIGHT[type],
      z: (r.z0 + r.z1) / 2 - layout.floor.depth / 2,
      // Doors start closed; FirstPerson refreshes the hint from the live door state.
      action: actionFor(type, type === 'office_door' ? false : !screensOff.includes(it.id)),
    });
  }
  return out;
}

/**
 * The interactable closest to the crosshair: within `reach` metres (horizontal) of the eye and at most
 * `maxDeg` off the view direction. `dir` need not be normalised.
 */
export function aimTarget(
  pos: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  list: readonly Interactable[],
  reach = 2,
  maxDeg = 12,
): Interactable | null {
  const dl = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const minCos = Math.cos((maxDeg * Math.PI) / 180);
  let best: { it: Interactable; cos: number } | null = null;
  for (const it of list) {
    const tx = it.x - pos.x;
    const ty = it.y - pos.y;
    const tz = it.z - pos.z;
    if (Math.hypot(tx, tz) > reach) continue;
    const tl = Math.hypot(tx, ty, tz) || 1;
    const cos = (tx * dir.x + ty * dir.y + tz * dir.z) / (tl * dl);
    if (cos >= minCos && (!best || cos > best.cos)) best = { it, cos };
  }
  return best?.it ?? null;
}

/** New `screensOff` after switching one screen on / off; ids of screens no longer in the layout are dropped. */
export function toggledScreens(screensOff: readonly string[], id: string, layout: OfficeLayout): string[] {
  const exists = new Set(layout.items.filter((i) => i.type === 'wall_screen').map((i) => i.id));
  const kept = screensOff.filter((s) => exists.has(s) && s !== id);
  return screensOff.includes(id) ? kept : [...kept, id];
}
