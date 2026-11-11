import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BRAINS } from '../Employee';
import { parkFrame, parkShops } from '../park/park-layout';
import { fpControl } from '../cameras/FirstPerson';
import { footprintRect } from '@shared/catalog';
import type { OfficeLayout, PlacedItem } from '@shared/domain';
import { useBuild } from '../../state/build';

// e2e support (002 T029): project a floor-space point (metres from the office's north-west corner) to
// page coordinates, so tests can press and drag on real objects in the 3D canvas. Read-only.
// 002 T097: only installed in dev or when the browser is automated (Playwright sets navigator.webdriver),
// never for a normal user of the production build.
export const testHooksEnabled = (): boolean => !!import.meta.env?.DEV || (typeof navigator !== 'undefined' && navigator.webdriver === true);

declare global {
  interface Window {
    __agentOffice?: {
      project(x: number, z: number, y?: number): { x: number; y: number };
      /** Arrange-mode state, for assertions and debugging. */
      arrange(): { active: boolean; selectedId: string | null; drag: unknown; seating: Record<string, string | null>; past: number; items: PlacedItem[]; meetingSeating: Record<string, string | null> };
      /** 004 U4-4: every employee brain. */
      brains(): { id: string; mode: string; activity: string | null; x: number; z: number; outside: boolean }[];
      /** 004 U4-4: shorten breaks (ms between breaks) for e2e. */
      setBreakInterval(ms: number): void;
      /** 004 U4-4: the park shops (world positions). */
      shops(): { id: string; x: number; z: number }[];
      /** 004 U4-4: the first-person user (null outside first person). World coordinates. */
      player(): { x: number; z: number; pose: 'standing' | 'sit' | 'lie'; aim: { itemId: string; action: string } | null } | null;
      teleportPlayer(x: number, z: number, yaw: number, pitch?: number): void;
      /** 004: world position (centre) of a layout item. */
      itemWorld(id: string): { x: number; z: number } | null;
    };
  }
}

export function TestHooks({ layout }: { layout: OfficeLayout }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    window.__agentOffice = {
      project(x, z, y = 0) {
        const v = new THREE.Vector3(x - layout.floor.width / 2, y, z - layout.floor.depth / 2).project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      arrange() {
        const b = useBuild.getState();
        return { active: b.active, selectedId: b.selectedId, drag: b.drag, seating: b.seating, past: b.past.length, items: b.draft?.items ?? layout.items, meetingSeating: b.meetingSeating };
      },
      brains() {
        return [...BRAINS].map(([id, b]) => ({ id, mode: b.modeKind, activity: b.activity, x: b.position.x, z: b.position.z, outside: b.outside }));
      },
      setBreakInterval(ms) {
        for (const b of BRAINS.values()) b.setBreakInterval(ms);
      },
      shops() {
        return parkShops(parkFrame(layout.floor)).map((s) => ({ id: s.id, x: s.x, z: s.z }));
      },
      player() {
        return fpControl.state?.() ?? null;
      },
      teleportPlayer(x, z, yaw, pitch) {
        fpControl.teleport?.(x, z, yaw, pitch);
      },
      itemWorld(id) {
        const it = layout.items.find((i) => i.id === id);
        if (!it) return null;
        const r = footprintRect(it);
        return { x: (r.x0 + r.x1) / 2 - layout.floor.width / 2, z: (r.z0 + r.z1) / 2 - layout.floor.depth / 2 };
      },
    };
    return () => {
      delete window.__agentOffice;
    };
  }, [camera, gl, layout]);
  return null;
}
