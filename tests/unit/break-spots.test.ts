import { describe, expect, it } from 'vitest';
import type { OfficeLayout } from '../../src/shared/domain';
import { defaultLayout } from '../../src/server/services/default-layout';
import { PLAYER, sofaSpots, SpotBook } from '../../src/web/scene/break-spots';
import { parkFrame, parkShops } from '../../src/web/scene/park/park-layout';

// 004 T027 (data-model §6): bookings for sofa seats, shop spots and outing slots.

function withSofa(): OfficeLayout {
  const l = defaultLayout();
  if (l.items.some((i) => i.type === 'sofa')) return l;
  return { ...l, items: [...l.items, { id: 'sofa-x', type: 'sofa', pos: { x: 1, z: 1 }, rotation: 0 }] };
}

describe('SpotBook', () => {
  it('one owner per spot; lying books both seats; release frees everything', () => {
    const layout = withSofa();
    const [l, r] = sofaSpots(layout);
    expect(l!.id.endsWith(':L') && r!.id.endsWith(':R')).toBe(true);
    const b = new SpotBook();
    expect(b.reserve('a', l!.id)).toBe(true);
    expect(b.reserve('b', l!.id)).toBe(false);
    expect(b.reserve('b', l!.id, r!.id)).toBe(false); // all or nothing
    expect(b.isFree(r!.id)).toBe(true);
    b.release('a');
    expect(b.reserve('b', l!.id, r!.id)).toBe(true);
    expect(b.spotsOf('b').sort()).toEqual([l!.id, r!.id].sort());
    expect(b.reserve(PLAYER, r!.id)).toBe(false); // the user cannot sit on an employee
  });

  it('caps outings at max(1, floor(n/3))', () => {
    const b = new SpotBook();
    b.setPopulation(2);
    expect(b.outingSlots).toBe(1);
    expect(b.tryOuting('a')).toBe(true);
    expect(b.tryOuting('b')).toBe(false);
    b.setPopulation(9);
    expect(b.tryOuting('b')).toBe(true);
    expect(b.tryOuting('c')).toBe(true);
    expect(b.tryOuting('d')).toBe(false);
    b.endOuting('a');
    expect(b.tryOuting('d')).toBe(true);
    expect(b.outsideCount).toBe(3);
  });

  it('revalidate drops spots of a removed sofa and reports their owners', () => {
    const layout = withSofa();
    const shops = parkShops(parkFrame(layout.floor));
    const b = new SpotBook();
    const sofa = sofaSpots(layout)[0]!;
    b.reserve('a', sofa.id);
    b.reserve('c', shops[0]!.seats[0]!.id);
    const without = { ...layout, items: layout.items.filter((i) => i.type !== 'sofa') };
    expect(b.revalidate(without, shops)).toEqual(['a']);
    expect(b.isFree(sofa.id)).toBe(true);
    expect(b.isFree(shops[0]!.seats[0]!.id)).toBe(false);
  });
});
