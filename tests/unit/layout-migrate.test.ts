import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLayoutV1, migrateV1toV2 } from '../../src/shared/layout-migrate';
import { validateLayout } from '../../src/shared/layout-validation';
import { officeLayoutSchema } from '../../src/shared/schemas';
import { defaultLayout } from '../../src/server/services/default-layout';
import { LayoutStore } from '../../src/server/services/layout-store';
import type { OfficeLayoutV1, PlacedItemV1 } from '../../src/shared/domain';

// 002 T013 — v1 → v2 migration (data-model §3) keeps every desk, chair and other item (FR-014).

/** The 001 default office, verbatim (32 × 24 cells, perimeter walls as items, door at (14, 23)). */
function defaultV1(): OfficeLayoutV1 {
  const items: PlacedItemV1[] = [];
  let n = 0;
  const add = (type: PlacedItemV1['type'], x: number, z: number, rotation: PlacedItemV1['rotation'] = 0) =>
    items.push({ id: `${type}-${++n}`, type, cell: { x, z }, rotation });
  for (const z of [4, 10, 16])
    for (const x of [4, 10, 16, 22]) {
      add('desk', x, z);
      add('chair', x + 1, z + 2);
    }
  for (let x = 0; x < 32; x++) add('glass_wall', x, 0);
  for (let z = 0; z < 24; z++) {
    add('wall', 0, z, 90);
    add('wall', 31, z, 90);
  }
  for (let x = 0; x < 32; x++) if (x < 14 || x > 15) add('wall', x, 23);
  add('door', 14, 23);
  add('wall_screen', 13, 1);
  add('water_cooler', 29, 20);
  add('sofa', 26, 1);
  for (const [x, z] of [
    [1, 1],
    [1, 21],
    [30, 1],
    [28, 21],
    [9, 21],
    [20, 21],
  ] as const)
    add('plant', x, z);
  return { schemaVersion: 1, floor: { widthCells: 32, depthCells: 24, cellSize: 0.5 }, items };
}

describe('migrateV1toV2', () => {
  const v1 = defaultV1();
  const v2 = migrateV1toV2(v1);

  it('detects v1 documents', () => {
    expect(isLayoutV1(v1)).toBe(true);
    expect(isLayoutV1(v2)).toBe(false);
  });

  it('keeps all 12 desks, 12 chairs and every other piece of furniture at cell × 0.5 m', () => {
    const count = (t: string) => v2.items.filter((i) => i.type === t).length;
    expect(count('desk')).toBe(12);
    expect(count('chair')).toBe(12);
    expect(count('plant')).toBe(6);
    expect(count('sofa') + count('water_cooler') + count('wall_screen')).toBe(3);
    const desk = v2.items.find((i) => i.id === 'desk-1')!;
    expect(desk.pos).toEqual({ x: 2, z: 2 });
  });

  it('turns perimeter walls into the shell and the door into shell.door', () => {
    expect(v2.items.some((i) => i.type === 'wall' || i.type === 'glass_wall' || i.type === 'door')).toBe(false);
    expect(v2.floor).toEqual({ width: 16, depth: 12 });
    expect(v2.shell).toEqual({ glassSide: 'north', door: { side: 'south', offset: 7 } });
  });

  it('keeps interior walls, converts the same office as the v2 default, and is valid', () => {
    const inner: PlacedItemV1 = { id: 'inner', type: 'glass_wall', cell: { x: 12, z: 14 }, rotation: 90 };
    const m = migrateV1toV2({ ...v1, items: [...v1.items, inner] });
    expect(m.items.find((i) => i.id === 'inner')).toMatchObject({ pos: { x: 6, z: 7 }, rotation: 90 });
    expect(officeLayoutSchema.safeParse(v2).success).toBe(true);
    expect(validateLayout(v2)).toMatchObject({ ok: true });
    const pos = (l: { items: { type: string; pos: { x: number; z: number } }[] }) =>
      l.items.map((i) => `${i.type}@${i.pos.x},${i.pos.z}`).sort();
    expect(pos(v2)).toEqual(pos(defaultLayout()));
  });

  it('puts a missing door in the middle of the south side', () => {
    const m = migrateV1toV2({ ...v1, items: v1.items.filter((i) => i.type !== 'door') });
    expect(m.shell.door).toEqual({ side: 'south', offset: 7.5 });
  });
});

describe('LayoutStore migrates layout.json once and keeps a backup', () => {
  it('writes v2, keeps layout.v1.bak.json, and never overwrites the backup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ao-layout-'));
    const v1 = defaultV1();
    writeFileSync(join(dir, 'layout.json'), JSON.stringify(v1));
    const store = new LayoutStore(dir);
    const layout = await store.get();
    expect(layout.schemaVersion).toBe(2);
    expect(JSON.parse(readFileSync(join(dir, 'layout.json'), 'utf8')).schemaVersion).toBe(2);
    expect(JSON.parse(readFileSync(join(dir, 'layout.v1.bak.json'), 'utf8'))).toEqual(v1);

    // A later v1 file (e.g. restored by hand) is migrated again, but the first backup is kept.
    writeFileSync(join(dir, 'layout.json'), JSON.stringify({ ...v1, items: v1.items.slice(0, 10) }));
    await new LayoutStore(dir).get();
    expect(JSON.parse(readFileSync(join(dir, 'layout.v1.bak.json'), 'utf8')).items.length).toBe(v1.items.length);
  });

  it('starts from the v2 default when there is no file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ao-layout-'));
    expect((await new LayoutStore(dir).get()).schemaVersion).toBe(2);
    expect(existsSync(join(dir, 'layout.v1.bak.json'))).toBe(false);
  });
});
