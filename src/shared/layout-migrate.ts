import { CELL } from './catalog';
import { DOOR_WIDTH, type DoorSide, type OfficeLayout, type OfficeLayoutV1, type PlacedItem } from './domain';

// Layout v1 → v2 (specs/002-realistic-ui-refresh/data-model.md §3 "Chuyển đổi v1 → v2"). Pure.
// - floor: cells × 0.5 m
// - furniture and interior walls keep their position: pos = cell × 0.5 m
// - walls/glass on the perimeter become the generated shell; the door becomes shell.door

export function isLayoutV1(raw: unknown): raw is OfficeLayoutV1 {
  return !!raw && typeof raw === 'object' && (raw as { schemaVersion?: unknown }).schemaVersion === 1;
}

export function migrateV1toV2(v1: OfficeLayoutV1): OfficeLayout {
  const W = v1.floor.widthCells;
  const D = v1.floor.depthCells;
  const width = W * CELL;
  const depth = D * CELL;
  const edge = (t: string) => t === 'wall' || t === 'glass_wall';
  const onPerimeter = (it: OfficeLayoutV1['items'][number]) => {
    if (!edge(it.type)) return false;
    const horizontal = it.rotation === 0 || it.rotation === 180;
    return horizontal ? it.cell.z === 0 || it.cell.z === D - 1 : it.cell.x === 0 || it.cell.x === W - 1;
  };

  let door: { side: DoorSide; offset: number } | null = null;
  const items: PlacedItem[] = [];
  for (const it of v1.items) {
    if (it.type === 'door') {
      if (door) continue;
      const near = 2;
      let side: DoorSide | null = null;
      let offset = 0;
      if (it.cell.z >= D - near) [side, offset] = ['south', it.cell.x * CELL];
      else if (it.cell.x >= W - near) [side, offset] = ['east', it.cell.z * CELL];
      else if (it.cell.x < near) [side, offset] = ['west', it.cell.z * CELL];
      if (side) door = { side, offset: clampDoor(offset, side === 'south' ? width : depth) };
      continue;
    }
    if (onPerimeter(it)) continue;
    items.push({ id: it.id, type: it.type, pos: { x: it.cell.x * CELL, z: it.cell.z * CELL }, rotation: it.rotation });
  }
  return {
    schemaVersion: 2,
    floor: { width, depth },
    shell: { glassSide: 'north', door: door ?? { side: 'south', offset: clampDoor(width / 2 - DOOR_WIDTH / 2, width) } },
    items,
  };
}

function clampDoor(offset: number, sideLen: number): number {
  return Math.min(Math.max(0, offset), sideLen - DOOR_WIDTH);
}
