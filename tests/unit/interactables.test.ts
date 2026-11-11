import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { aimTarget, buildInteractables, toggledScreens } from '../../src/web/scene/interaction/interactables';

// 004 T044 (R4-08, FR-030/031): what the crosshair points at, and the hint text.

const layout = defaultLayout();

describe('interactables', () => {
  it('lists screens, sofas, the cooler and plants with their hint', () => {
    const list = buildInteractables(layout);
    const types = new Set(list.map((i) => i.type));
    for (const t of ['wall_screen', 'sofa', 'water_cooler', 'plant']) expect(types.has(t as never)).toBe(true);
    const screen = list.find((i) => i.type === 'wall_screen')!;
    // On by default (the first screen shows the quota); switched off → the hint offers to switch it on.
    expect(screen.action).toBe('Turn screen off');
    expect(buildInteractables(layout, [screen.itemId]).find((i) => i.itemId === screen.itemId)!.action).toBe('Turn screen on');
    expect(list.find((i) => i.type === 'water_cooler')!.action).toBe('Drink water');
    expect(list.find((i) => i.type === 'plant')!.action).toBe('Water the plant');
    expect(list.find((i) => i.type === 'sofa')!.action).toMatch(/^Sit/);
  });

  it('aims within 2 m and 12°, picks the one nearest the crosshair', () => {
    const list = buildInteractables(layout);
    const cooler = list.find((i) => i.type === 'water_cooler')!;
    const eye = { x: cooler.x, y: 1.65, z: cooler.z + 1.5 };
    const at = (t: { x: number; y: number; z: number }) => ({ x: t.x - eye.x, y: t.y - eye.y, z: t.z - eye.z });
    expect(aimTarget(eye, at(cooler), list)?.itemId).toBe(cooler.itemId);
    // 20° off: nothing.
    const d = at(cooler);
    const a = (20 * Math.PI) / 180;
    expect(aimTarget(eye, { x: d.x * Math.cos(a) - d.z * Math.sin(a), y: d.y, z: d.x * Math.sin(a) + d.z * Math.cos(a) }, [cooler])).toBeNull();
    // Too far.
    expect(aimTarget({ ...eye, z: cooler.z + 3 }, { x: 0, y: -0.2, z: -1 }, [cooler])).toBeNull();
  });

  it('toggles a screen and drops screens no longer in the layout', () => {
    const id = layout.items.find((i) => i.type === 'wall_screen')!.id;
    expect(toggledScreens([], id, layout)).toEqual([id]);
    expect(toggledScreens([id], id, layout)).toEqual([]);
    expect(toggledScreens(['gone'], id, layout)).toEqual([id]);
  });
});

describe('office doors (008)', () => {
  it('an office door can be used with E; its hint follows the door state', async () => {
    const { doorAction } = await import('../../src/web/scene/interaction/interactables');
    const layout = { ...defaultLayout(), items: [...defaultLayout().items, { id: 'd', type: 'office_door' as const, pos: { x: 14, z: 3 }, rotation: 90 as const }] };
    const door = buildInteractables(layout).find((i) => i.itemId === 'd')!;
    expect(door).toMatchObject({ type: 'office_door', action: 'Open door', y: 1.1 });
    expect(doorAction(true)).toBe('Close door');
  });
});
