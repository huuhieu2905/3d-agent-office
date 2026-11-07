import { describe, expect, it } from 'vitest';
import { BODY_RADIUS, LANES, createWalkers, stepWalker, walkerPose } from '../../src/web/scene/park/walkers';
import { PATH_WIDTH, parkFrame } from '../../src/web/scene/park/park-layout';

// 002 T096 / FR-041: park walkers and joggers never walk through each other (no crowd solver needed).

describe.each([
  { width: 6, depth: 6 },
  { width: 16, depth: 12 },
  { width: 40, depth: 40 },
])('park loop for a $width × $depth m office', (floor) => {
  it('keeps every lane on the path', () => {
    for (const L of LANES) expect(Math.abs(L.lane) + 0.25).toBeLessThanOrEqual(PATH_WIDTH / 2);
  });

  it('never lets two people overlap during 5 simulated minutes (high detail, 7 per lane)', () => {
    const frame = parkFrame(floor);
    const walkers = createWalkers(7, 3);
    let min = Infinity;
    for (let s = 0; s < 5 * 60 * 20; s++) {
      for (const w of walkers) stepWalker(frame, w, 1 / 20);
      const pts = walkers.map((w) => walkerPose(frame, w));
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.z - pts[j]!.z));
    }
    expect(min).toBeGreaterThanOrEqual(2 * BODY_RADIUS);
  });
});
