import { beforeEach, describe, expect, it } from 'vitest';
import { useBuild } from '../../src/web/state/build';
import type { OfficeLayout } from '../../src/shared/domain';
import { defaultLayout } from '../../src/server/services/default-layout';

// 007 US3 / data-model §6: meeting seats in the build draft (spec Q1 = A: the desk stays reserved).

const layout = (): OfficeLayout => ({ ...defaultLayout(), items: [...defaultLayout().items, { id: 'mt', type: 'meeting_table_8', pos: { x: 14, z: 3 }, rotation: 90 }] });
const desks = { a: 'desk-1', b: 'desk-3' };
const noSeats = { a: null, b: null };
const st = () => useBuild.getState();

beforeEach(() => {
  st().end();
  st().begin(layout());
});

describe('build draft meeting seats', () => {
  it('drops an employee on a free seat; the desk seating is untouched (desk stays reserved)', () => {
    st().assignMeetingSeat('a', 'mt#2', noSeats);
    expect(st().meetingSeating).toEqual({ a: 'mt#2' });
    expect(st().seating).toEqual({});
  });

  it('dropping on an occupied seat swaps the two employees', () => {
    st().assignMeetingSeat('a', 'mt#2', noSeats);
    st().assignMeetingSeat('b', 'mt#5', noSeats);
    st().assignMeetingSeat('a', 'mt#5', noSeats);
    expect(st().meetingSeating).toEqual({ a: 'mt#5', b: 'mt#2' });
  });

  it('dropping on their own desk ends the meeting', () => {
    st().assignMeetingSeat('a', 'mt#2', noSeats);
    st().assignSeat('a', 'desk-1', desks);
    expect(st().meetingSeating).toEqual({ a: null });
    expect(st().seating).toEqual({}); // already their desk: no desk change
  });

  it('dropping on another desk swaps desks and ends the meeting', () => {
    st().assignMeetingSeat('a', 'mt#2', noSeats);
    st().assignSeat('a', 'desk-3', desks);
    expect(st().seating).toEqual({ a: 'desk-3', b: 'desk-1' });
    expect(st().meetingSeating).toEqual({ a: null });
  });

  it('undo restores both maps; deleting the table clears its seats', () => {
    st().assignMeetingSeat('a', 'mt#2', noSeats);
    st().assignSeat('a', 'desk-3', desks);
    st().undo();
    expect(st().meetingSeating).toEqual({ a: 'mt#2' });
    expect(st().seating).toEqual({});
    st().select('mt');
    st().removeSelected();
    expect(st().meetingSeating).toEqual({ a: null });
  });
});

describe('build draft frames (007 US5)', () => {
  it('R flips a frame to the other side of its glass; deleting the glass removes the frame', () => {
    st().end();
    const l = layout();
    l.items.push({ id: 'g', type: 'long_glass', pos: { x: 13, z: 7 }, rotation: 0 }, { id: 'f', type: 'painting', pos: { x: 13.5, z: 7 }, rotation: 0 });
    st().begin(l);
    st().select('f');
    st().rotateSelected();
    expect(st().draft!.items.find((i) => i.id === 'f')!.rotation).toBe(180);
    st().select('g');
    st().removeSelected();
    expect(st().draft!.items.some((i) => i.id === 'f')).toBe(false);
    st().undo();
    expect(st().draft!.items.filter((i) => i.id === 'f' || i.id === 'g')).toHaveLength(2);
  });

  it('R does nothing to a frame on the outer wall', () => {
    st().end();
    const l = layout();
    l.items.push({ id: 'f', type: 'photo_frame', pos: { x: 0, z: 6 }, rotation: 90 });
    st().begin(l);
    st().select('f');
    st().rotateSelected();
    expect(st().draft!.items.find((i) => i.id === 'f')!.rotation).toBe(90);
  });
});
