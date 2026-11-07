import { describe, expect, it } from 'vitest';
import { validateLayout } from '../../src/shared/layout-validation';
import { defaultLayout } from '../../src/server/services/default-layout';
import type { OfficeLayout, PlacedItem } from '../../src/shared/domain';

const withItems = (extra: PlacedItem[], base = defaultLayout()): OfficeLayout => ({ ...base, items: [...base.items, ...extra] });

describe('validateLayout (data-model §5)', () => {
  it('accepts the default layout', () => {
    expect(validateLayout(defaultLayout())).toMatchObject({ ok: true, invalidItems: [] });
  });

  it('rejects items outside the floor', () => {
    const r = validateLayout(withItems([{ id: 'p-out', type: 'plant', cell: { x: 32, z: 5 }, rotation: 0 }]));
    expect(r.invalidItems).toContain('p-out');
  });

  it('rejects overlapping blocking items', () => {
    const desk = defaultLayout().items.find((i) => i.type === 'desk')!;
    const r = validateLayout(withItems([{ id: 'overlap', type: 'plant', cell: { ...desk.cell }, rotation: 0 }]));
    expect(r.invalidItems).toContain('overlap');
  });

  it('allows a wall and a plant in the same cell (walls only block edges)', () => {
    const r = validateLayout(withItems([{ id: 'p-wall', type: 'plant', cell: { x: 2, z: 22 }, rotation: 0 }]));
    expect(r.ok).toBe(true);
  });

  it('rejects a desk whose seat is blocked', () => {
    const desk = defaultLayout().items.find((i) => i.type === 'desk')!;
    const r = validateLayout(withItems([{ id: 'blocker', type: 'plant', cell: { x: desk.cell.x + 1, z: desk.cell.z + 2 }, rotation: 0 }]));
    expect(r.invalidItems).toContain(desk.id);
  });

  it('rejects a desk cut off from the door', () => {
    const base = defaultLayout();
    // A ring of glass walls around the first desk's seat area.
    const desk = base.items.find((i) => i.type === 'desk')!;
    const sx = desk.cell.x + 1;
    const sz = desk.cell.z + 2;
    const ring: PlacedItem[] = [
      { id: 'r1', type: 'glass_wall', cell: { x: sx, z: sz + 1 }, rotation: 0 },
      { id: 'r2', type: 'glass_wall', cell: { x: sx, z: sz }, rotation: 90 },
      { id: 'r3', type: 'glass_wall', cell: { x: sx + 1, z: sz }, rotation: 90 },
    ];
    const r = validateLayout(withItems(ring, base));
    expect(r.invalidItems).toContain(desk.id);
  });

  it('requires a door', () => {
    const base = defaultLayout();
    const r = validateLayout({ ...base, items: base.items.filter((i) => i.type !== 'door') });
    expect(r.ok).toBe(false);
  });
});
