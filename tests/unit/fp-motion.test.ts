import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { freeAt, slide } from '../../src/web/scene/cameras/fp-motion';

const layout = defaultLayout();
const grid = new OfficeGrid(layout);

describe('first-person collision (FR-071)', () => {
  it('cannot walk into a desk', () => {
    const desk = layout.items.find((i) => i.type === 'desk')!;
    const [x, , z] = grid.toWorld(grid.floorToCell(desk.pos.x + 0.75, desk.pos.z + 0.5));
    expect(freeAt(grid, x, z)).toBe(false);
  });

  it('cannot walk out through the south side except at the door', () => {
    const [x0, , z0] = grid.toWorld(grid.floorToCell(2.6, 11.4));
    let p = { x: x0, z: z0 };
    for (let i = 0; i < 40; i++) p = slide(grid, p.x, p.z, 0, 0.1);
    expect(p.z).toBeLessThan(layout.floor.depth / 2);
  });

  it('slides along the side instead of stopping', () => {
    const [x0, , z0] = grid.toWorld(grid.floorToCell(2.6, 11.6));
    const p = slide(grid, x0, z0, 0.2, 0.2);
    expect(p.x).toBeGreaterThan(x0);
    expect(p.z).toBeLessThan(layout.floor.depth / 2);
  });
});
