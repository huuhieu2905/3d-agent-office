import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { freeAt, slide } from '../../src/web/scene/cameras/fp-motion';

const layout = defaultLayout();
const grid = new OfficeGrid(layout);

describe('first-person collision (FR-071)', () => {
  it('cannot walk into a desk', () => {
    const desk = layout.items.find((i) => i.type === 'desk')!;
    const [x, , z] = grid.toWorld({ x: desk.cell.x + 1, z: desk.cell.z });
    expect(freeAt(grid, x, z)).toBe(false);
  });

  it('cannot walk through the south wall except at the door', () => {
    const [x0, , z0] = grid.toWorld({ x: 5, z: 22 });
    let p = { x: x0, z: z0 };
    for (let i = 0; i < 40; i++) p = slide(grid, p.x, p.z, 0, 0.1);
    expect(grid.toCell(p.x, p.z).z).toBe(22);
  });

  it('slides along a wall instead of stopping', () => {
    const [x0, , z0] = grid.toWorld({ x: 5, z: 22 });
    const p = slide(grid, x0, z0, 0.2, 0.2);
    expect(p.x).toBeGreaterThan(x0);
    expect(grid.toCell(p.x, p.z).z).toBe(22);
  });
});
