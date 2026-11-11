import { describe, expect, it } from 'vitest';
import { DoorBook } from '../../src/web/scene/doors';
import type { OfficeLayout } from '../../src/shared/domain';

// 008 US1/US2 (research R8-01, data-model §2): office door states.

// 10 × 8 m floor; an office door on the north-south line x = 4 m, z 2–3 m → world x = -1, z -2…-1.
const layout: Pick<OfficeLayout, 'floor' | 'items'> = {
  floor: { width: 10, depth: 8 },
  items: [{ id: 'd', type: 'office_door', pos: { x: 4, z: 2 }, rotation: 90 }],
};
const DOORWAY = { x: -1, z: -1.5 };
const FAR = { x: 3, z: 3 };

function run(b: DoorBook, seconds: number, start: number, people: { x: number; z: number }[] = []): number {
  let now = start;
  for (let i = 0; i < seconds * 60; i++) {
    now += 1000 / 60;
    b.tick(1 / 60, now, people);
  }
  return now;
}

describe('DoorBook', () => {
  it('starts closed; a request opens it within 0.6 s', () => {
    const b = new DoorBook(layout);
    expect(b.ids).toEqual(['d']);
    expect(b.openness('d')).toBe(0);
    b.request('d', 'e1');
    let now = run(b, 0.45, 10_000, [FAR]);
    expect(b.isOpen('d')).toBe(false);
    now = run(b, 0.15, now, [FAR]);
    expect(b.isOpen('d')).toBe(true);
    void now;
  });

  it('stays open while held and closes 2 s after release with a clear doorway, not before', () => {
    const b = new DoorBook(layout);
    b.request('d', 'e1');
    let now = run(b, 3, 10_000);
    expect(b.openness('d')).toBe(1);
    b.release('d', 'e1');
    now = run(b, 1.8, now);
    expect(b.openness('d')).toBe(1);
    run(b, 0.9, now);
    expect(b.openness('d')).toBe(0);
  });

  it('never closes while someone stands in the doorway', () => {
    const b = new DoorBook(layout);
    b.toggleUser('d');
    let now = run(b, 1, 10_000, [DOORWAY]);
    b.toggleUser('d'); // the user closes it while standing in it
    now = run(b, 5, now, [DOORWAY]);
    expect(b.isOpen('d')).toBe(true);
    run(b, 3, now, [FAR]);
    expect(b.openness('d')).toBe(0);
  });

  it('standing at a closed door does not open it', () => {
    const b = new DoorBook(layout);
    run(b, 3, 10_000, [DOORWAY]);
    expect(b.openness('d')).toBe(0);
  });

  it('the user toggle opens and closes; an employee passing clears it (rest state closed)', () => {
    const b = new DoorBook(layout);
    b.toggleUser('d');
    let now = run(b, 1, 10_000);
    expect(b.isOpen('d')).toBe(true);
    b.toggleUser('d');
    now = run(b, 1, now);
    expect(b.openness('d')).toBe(0);
    b.toggleUser('d');
    b.request('d', 'e1');
    now = run(b, 1, now);
    b.release('d', 'e1');
    expect(b.isUserOpen('d')).toBe(false);
    run(b, 3, now);
    expect(b.openness('d')).toBe(0);
  });

  it('blocksMove: across a closed door yes, across an open one or along the wall no; doorBetween finds it', () => {
    const b = new DoorBook(layout);
    expect(b.blocksMove(-1.3, -1.5, -1.1, -1.5)).toBe(true);
    expect(b.blocksMove(-1.3, -1.0 - 1.5, -1.3, -0.5)).toBe(false); // parallel to the door, 0.3 m away
    expect(b.doorBetween(-1.125, -1.625, -0.875, -1.625)).toBe('d');
    expect(b.doorBetween(-1.125, 0.375, -0.875, 0.375)).toBeNull();
    b.toggleUser('d');
    run(b, 1, 10_000);
    expect(b.blocksMove(-1.3, -1.5, -1.1, -1.5)).toBe(false);
  });
});
