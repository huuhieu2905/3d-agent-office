import { describe, expect, it } from 'vitest';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { EmployeeBrain } from '../../src/web/scene/employee-behaviors';
import { DoorBook } from '../../src/web/scene/doors';
import type { OfficeLayout, PlacedItem } from '../../src/shared/domain';

// 008 US1 (FR-002, SC-001, SC-002): employees stop at a closed office door, open it, pass, and it closes.

const item = (id: string, type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0): PlacedItem => ({ id, type, pos: { x, z }, rotation });
// 10 × 8 m; a 4 × 3 m room in the north-west corner closed by long glass and one office door (x = 4, z 2–3).
const layout: OfficeLayout = {
  schemaVersion: 2,
  floor: { width: 10, depth: 8 },
  shell: { glassSide: 'north', door: { side: 'south', offset: 4 } },
  items: [
    item('inside', 'desk', 1, 0.5),
    item('outside', 'desk', 7, 4),
    item('g1', 'long_glass', 0, 3),
    item('g2', 'long_glass', 2, 3),
    item('g3', 'long_glass', 4, 0, 90),
    item('door', 'office_door', 4, 2, 90),
  ],
};
const grid = new OfficeGrid(layout);
const DOOR_X = 4 - 5; // world x of the door line

interface Run {
  ms: number;
  crossedWhileClosed: boolean;
  passages: number;
}

/** Tick at 60 Hz until the brain sits, recording every crossing of the door line. */
function untilSeated(b: EmployeeBrain, doors: DoorBook, start: number, maxMs = 60_000): Run & { now: number } {
  let now = start;
  let side = Math.sign(b.position.x - DOOR_X);
  let crossedWhileClosed = false;
  let passages = 0;
  let t = 0;
  for (; t < maxMs; t += 1000 / 60) {
    now += 1000 / 60;
    const wasOpen = doors.isOpen('door');
    const p = b.tick(1 / 60, now);
    doors.tick(1 / 60, now, [b.position]);
    const s = Math.sign(p.x - DOOR_X);
    if (s !== 0 && s !== side) {
      if (Math.abs(p.z - (2.5 - 4)) < 0.6) {
        passages++;
        if (!wasOpen) crossedWhileClosed = true;
      }
      side = s;
    }
    if (b.modeKind === 'seated' && t > 200) break;
  }
  return { ms: t, crossedWhileClosed, passages, now };
}

function settle(doors: DoorBook, now: number, ms: number, who: { x: number; z: number }): number {
  for (let t = 0; t < ms; t += 1000 / 60) {
    now += 1000 / 60;
    doors.tick(1 / 60, now, [who]);
  }
  return now;
}

describe('employees and office doors', () => {
  it('waits for a closed door, never walks through it closed, loses ≤ 1 s, and the door closes after', () => {
    const doors = new DoorBook(layout);
    const b = new EmployeeBrain({ grid, seat: grid.seatOf('outside'), rng: () => 0.99, now: 0, doors, id: 'e1' });
    b.tick(0, 0);
    b.setSeat(grid.seatOf('inside'), 0);
    const closed = untilSeated(b, doors, 0);
    expect(closed.passages).toBe(1);
    expect(closed.crossedWhileClosed).toBe(false);
    settle(doors, closed.now, 2500, b.position);
    expect(doors.openness('door')).toBe(0);

    // The same walk through a door someone else keeps open the whole time.
    const open = new DoorBook(layout);
    open.request('door', 'someone-else');
    settle(open, 0, 1000, { x: 99, z: 99 });
    const b2 = new EmployeeBrain({ grid, seat: grid.seatOf('outside'), rng: () => 0.99, now: 0, doors: open, id: 'e2' });
    b2.tick(0, 0);
    b2.setSeat(grid.seatOf('inside'), 0);
    const free = untilSeated(b2, open, 0);
    expect(closed.ms - free.ms).toBeGreaterThan(0); // it did wait
    expect(closed.ms - free.ms).toBeLessThanOrEqual(1000);
  });

  it('10 passages: the door opens before every crossing and is closed again afterwards (SC-001)', () => {
    const doors = new DoorBook(layout);
    const b = new EmployeeBrain({ grid, seat: grid.seatOf('inside'), rng: () => 0.99, now: 0, doors, id: 'e1' });
    let now = 0;
    b.tick(0, now);
    let passages = 0;
    for (let k = 0; k < 10; k++) {
      b.setSeat(grid.seatOf(k % 2 === 0 ? 'outside' : 'inside'), now);
      const r = untilSeated(b, doors, now);
      expect(r.crossedWhileClosed).toBe(false);
      passages += r.passages;
      now = settle(doors, r.now, 2500, b.position);
      expect(doors.openness('door')).toBe(0);
    }
    expect(passages).toBe(10);
  });
});
