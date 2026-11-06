import { describe, expect, it } from 'vitest';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/web/scene/grid/grid';
import { BREAK_JITTER_MS, BREAK_MEAN_MS, EmployeeBrain } from '../../src/web/scene/employee-behaviors';

const layout = defaultLayout();
const grid = new OfficeGrid(layout);
const desk = layout.items.find((i) => i.type === 'desk')!;
const seat = grid.seatOf(desk.id)!;

function run(brain: EmployeeBrain, ms: number, start: number, step = 100) {
  let now = start;
  let pose = brain.tick(0, now);
  const modes = new Set<string>();
  for (let t = 0; t < ms; t += step) {
    now += step;
    pose = brain.tick(step / 1000, now);
    modes.add(brain.modeKind);
  }
  return { pose, now, modes };
}

describe('EmployeeBrain', () => {
  it('sits at its desk facing the desk', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.99, now: 0 });
    const p = b.tick(0, 0);
    const [x, , z] = grid.toWorld(seat);
    expect([p.x, p.z]).toEqual([x, z]);
    expect(p.seated).toBe(true);
    expect(p.clip).toBe('Sitting');
  });

  it('takes a break within 5 ± 2 minutes when idle and returns to the SAME desk', () => {
    let r = 0;
    const seq = [0.5, 0.1, 0.5, 0.5, 0.5];
    const b = new EmployeeBrain({ grid, seat, rng: () => seq[r++ % seq.length]!, now: 0 });
    b.setVisual('idle', 0);
    const { modes, now } = run(b, BREAK_MEAN_MS + BREAK_JITTER_MS + 60_000, 0, 200);
    expect(modes.has('walking') || modes.has('acting')).toBe(true);
    const end = run(b, 120_000, now, 200).pose;
    const [x, , z] = grid.toWorld(seat);
    expect(end.x).toBeCloseTo(x, 5);
    expect(end.z).toBeCloseTo(z, 5);
  });

  it('cuts a break short and goes back to work when the agent starts running', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.1, now: 0 });
    b.setVisual('idle', 0);
    const r1 = run(b, BREAK_MEAN_MS + BREAK_JITTER_MS, 0, 500);
    b.setVisual('working', r1.now);
    const r2 = run(b, 60_000, r1.now, 100);
    expect(b.modeKind).toBe('seated');
    expect(r2.pose.seated).toBe(true);
  });

  it('new employees walk in from the door; removed employees walk out and finish', () => {
    const b = new EmployeeBrain({ grid, seat, enter: true, rng: () => 0.9, now: 0 });
    expect(b.modeKind).toBe('entering');
    run(b, 60_000, 0, 100);
    expect(b.modeKind).toBe('seated');
    b.leave(60_000);
    run(b, 60_000, 60_000, 100);
    expect(b.done).toBe(true);
  });

  it('freezes while disconnected', () => {
    const b = new EmployeeBrain({ grid, seat, rng: () => 0.9, now: 0 });
    b.setVisual('disconnected', 0);
    expect(b.tick(0.1, 10_000).clip).toBe('Idle');
  });
});
