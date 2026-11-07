import { describe, expect, it } from 'vitest';
import { floorSizeValid, minFloorSize, resizeBlockers } from '../../src/shared/layout-validation';
import { resizeLayout } from '../../src/shared/layout-resize';
import { defaultLayout } from '../../src/server/services/default-layout';

// 002 T049 — office size limits (FR-022..024, contracts/ui-interactions.md U-4).

describe('office size', () => {
  it('accepts 6–40 m in 0.5 m steps and refuses anything else', () => {
    for (const v of [6, 40, 23.5, 16]) expect(floorSizeValid(v), String(v)).toBe(true);
    for (const v of [5.5, 40.5, 10.3, 0, -6]) expect(floorSizeValid(v), String(v)).toBe(false);
  });

  it('growing keeps every item where it is (anchored at the north-west corner)', () => {
    const l = defaultLayout();
    const r = resizeLayout(l, 24, 18);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.floor).toEqual({ width: 24, depth: 18 });
    expect(r.layout.items.map((i) => i.pos)).toEqual(l.items.map((i) => i.pos));
  });

  it('shrinking below the furniture is refused and names the blockers', () => {
    const l = defaultLayout();
    const r = resizeLayout(l, 14, 12);
    if (r.ok || r.reason !== 'blocked') throw new Error('expected a blocked shrink');
    expect(r.blockers).toEqual(resizeBlockers(l, 14, 12));
    expect(r.blockers.length).toBeGreaterThan(0);
    expect(r.min).toEqual({ width: minFloorSize(l).width, depth: minFloorSize(l).depth });
  });

  it('refuses sizes outside the limits without touching the layout', () => {
    const r = resizeLayout(defaultLayout(), 41, 12);
    expect(r).toMatchObject({ ok: false, reason: 'limits' });
  });

  it('keeps the main door on its side when that side gets shorter', () => {
    const l = { ...defaultLayout(), items: [], shell: { glassSide: 'north' as const, door: { side: 'south' as const, offset: 14 } } };
    const r = resizeLayout(l, 8, 12);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.layout.shell.door.offset).toBe(7);
  });
});
