import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CITIES } from '../../src/shared/domain';
import { ROAD_RADIUS } from '../../src/web/scene/park/detail';
import { parkFrame, treeAllowed, treeCandidates } from '../../src/web/scene/park/park-layout';
import { LANDMARK_AT, cityLayout, kioskSpot } from '../../src/web/scene/city/city-layout';

// 002 T075 — FR-036..037: the city stays far out (no street or building within 30 m of the office), each
// city has ≥ 2 cafés and ≥ 2 restaurants on the street, and a park kiosk café is in the default view.

/** The overview camera's first framing (cameras/Overview.tsx): looking at the origin from (0, .75r, .85r). */
function defaultCamera(floor: { width: number; depth: number }) {
  const r = Math.max(floor.width, floor.depth);
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 600);
  cam.position.set(0, r * 0.75, r * 0.85);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}
const inView = (cam: THREE.PerspectiveCamera, x: number, y: number, z: number) => {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1;
};

describe.each([...CITIES])('city %s', (city) => {
  const layout = cityLayout(city, 'medium');

  it('has at least 2 cafés and 2 restaurants on the street, with names', () => {
    const shops = layout.front.filter((b) => b.shop);
    expect(shops.filter((b) => b.shop === 'cafe').length).toBeGreaterThanOrEqual(2);
    expect(shops.filter((b) => b.shop === 'resto').length).toBeGreaterThanOrEqual(2);
    for (const s of shops) expect(s.name).toBeTruthy();
  });

  it('keeps every building beyond the road (far from the office) and buildings apart', () => {
    for (const b of [...layout.front, ...layout.back]) expect(Math.hypot(b.x, b.z) - b.d / 2).toBeGreaterThan(ROAD_RADIUS + 2.4);
    const f = layout.front;
    for (let i = 0; i < f.length; i++)
      for (let j = i + 1; j < f.length; j++) {
        const gap = Math.hypot(f[i]!.x - f[j]!.x, f[i]!.z - f[j]!.z);
        expect(gap).toBeGreaterThan((f[i]!.w + f[j]!.w) / 2 - 0.05);
      }
  });

  it('leaves room for the landmark', () => {
    for (const b of layout.back) expect(Math.hypot(b.x - LANDMARK_AT.x, b.z - LANDMARK_AT.z)).toBeGreaterThan(20);
  });

  it('is stable for a seed (no flicker between visits)', () => {
    expect(cityLayout(city, 'medium')).toEqual(layout);
  });
});

describe('park kiosk café', () => {
  it.each([
    { width: 16, depth: 12 },
    { width: 28, depth: 20 },
    { width: 40, depth: 40 },
  ])('is seen from the default camera and no tree stands on it ($width × $depth)', (floor) => {
    const k = kioskSpot(parkFrame(floor));
    // At least its base is in the first frame (its roof may be cut at small offices).
    expect(inView(defaultCamera(floor), k.x, 0.5, k.z)).toBe(true);
    const f = parkFrame(floor);
    for (const t of treeCandidates(7, 600).filter((t) => treeAllowed(f, t.x, t.z))) expect(Math.hypot(t.x - k.x, t.z - k.z)).toBeGreaterThan(3.5);
  });
});
