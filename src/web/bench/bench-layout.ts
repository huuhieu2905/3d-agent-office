import type { OfficeLayout, PlacedItem } from '@shared/domain';

// Default office plus 8 extra desks so all 20 benchmark employees are seated (SC-004 scenario).
// Layout v2; mirrors src/server/services/default-layout.ts (the web bundle must not import server code).
// `floor` (T003/T056): a larger office, e.g. 40 × 40 m, keeps the same desk block in its north-west.

export function defaultBenchLayout(floor?: { width: number; depth: number }, opts: { sofa?: boolean; rooms?: boolean } = {}): OfficeLayout {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0) =>
    items.push({ id: `${type}-${++n}`, type, pos: { x, z }, rotation });
  const xs = [1, 3.5, 6, 8.5, 11, 13.5];
  const zs = [1.5, 4, 6.5, 9];
  let desks = 0;
  for (const z of zs)
    for (const x of xs) {
      if (desks >= 20) break;
      add('desk', x, z);
      add('chair', x + 0.5, z + 1);
      desks++;
    }
  add('wall_screen', 6.5, 0.2);
  add('water_cooler', 14.5, 10.5);
  // 004 bench "outing": a sofa so every kind of break happens.
  if (opts.sofa) add('sofa', 10.5, 10);
  for (const [x, z] of [
    [0.25, 0.5],
    [15.25, 0.5],
    [0.25, 10.5],
  ] as const)
    add('plant', x, z);
  const width = floor?.width ?? 16;
  const depth = floor?.depth ?? 12;
  // 007 SC-006 "rooms": two 8-seat meeting tables east of the desks and 8 frames with (bench) pictures on
  // the outer walls. Needs a floor of at least 22 × 14 m.
  if (opts.rooms) {
    add('meeting_table_8', 18, 2, 90);
    add('meeting_table_8', 18, 8, 90);
    for (const z of [2, 3.5, 5, 6.5]) items.push({ id: `photo-${z}`, type: 'photo_frame', pos: { x: 0, z }, rotation: 90, picture: `bench-${z}` });
    for (const x of [2, 4, 10, 12]) items.push({ id: `painting-${x}`, type: 'painting', pos: { x, z: depth }, rotation: 180, picture: `bench-${x}` });
  }
  return { schemaVersion: 2, floor: { width, depth }, shell: { glassSide: 'north', door: { side: 'south', offset: Math.min(7, width - 1) } }, items };
}
