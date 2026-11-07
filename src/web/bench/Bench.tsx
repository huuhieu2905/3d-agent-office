import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import type { Employee, VisualState } from '@shared/domain';
import { defaultBenchLayout } from './bench-layout';
import { OfficeScene } from '../scene/OfficeScene';
import { useEmployees } from '../state/employees';
import { useConnection } from '../state/connection';
import { useSettings } from '../state/settings';
import { useWeather } from '../state/weather';
import type { DetailLevel } from '@shared/domain';

// T058 / SC-004: 20 fake employees whose state changes every 2 s in the default office, with a fixed
// camera flight. Exposes window.__bench = { frames: number[] } for scripts/bench-fps.ts.

const STATES: VisualState[] = ['idle', 'working', 'thinking', 'waiting_for_boss', 'error', 'stopped'];
const APPEARANCES = ['worker-a', 'worker-b', 'worker-c', 'worker-d', 'worker-e', 'worker-f', 'worker-g', 'worker-h'];

declare global {
  interface Window {
    __bench?: { frames: number[]; startedAt: number };
  }
}

function fakeEmployees(tick: number, deskIds: string[]): Employee[] {
  return Array.from({ length: 20 }, (_, i) => ({
    conversationId: `bench-${i}`,
    name: `Nhân viên ${i + 1}`,
    visualState: STATES[(i + tick) % STATES.length]!,
    appearance: APPEARANCES[i % APPEARANCES.length]!,
    deskId: deskIds[i] ?? null,
    projectId: `p${i % 3}`,
    projectColor: ['#e4572e', '#2f6fed', '#2ec4b6'][i % 3]!,
    isSubagent: false,
    parentId: null,
    visible: true,
    lastActivityAt: new Date().toISOString(),
  }));
}

function Flight() {
  const camera = useThree((s) => s.camera);
  const t0 = useRef(performance.now());
  useFrame(() => {
    const t = (performance.now() - t0.current) / 1000;
    const a = t * 0.25;
    camera.position.set(Math.sin(a) * 15, 9 + Math.sin(t * 0.3) * 3, Math.cos(a) * 13);
    camera.lookAt(0, 0, 0);
    const b = window.__bench;
    if (b) b.frames.push(performance.now());
  });
  return null;
}

export function Bench() {
  const layout = defaultBenchLayout();
  const deskIds = layout.items.filter((i) => i.type === 'desk').map((d) => d.id);

  useEffect(() => {
    // T115: full scene — park, people, cars, skyline and rain — at ?detail= (default medium).
    const q = new URLSearchParams(location.search).get('detail');
    const detail: DetailLevel = q === 'low' || q === 'high' ? q : 'medium';
    useSettings.getState().set({ detailLevel: detail, city: 'hanoi', theme: 'light', autoLowerDetail: false });
    useWeather.getState().set({ city: 'hanoi', condition: 'rain', isDay: true, temperatureC: 26, fetchedAt: new Date().toISOString(), source: 'open-meteo' });
    useConnection.getState().setServerOnline(true);
    useConnection.getState().setApp({ kind: 'connected', appVersion: 'bench', versionSupported: true });
    let tick = 0;
    useEmployees.getState().snapshot(fakeEmployees(tick, deskIds), 0);
    window.__bench = { frames: [], startedAt: performance.now() };
    const id = setInterval(() => {
      tick++;
      useEmployees.getState().snapshot(fakeEmployees(tick, deskIds), 0);
    }, 2000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  return (
    <div className="app theme-light">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [10, 12, 14], fov: 45, far: 600 }}>
        <Suspense fallback={null}>
          <OfficeScene theme="light" layoutOverride={layout} benchMode />
          <Flight />
        </Suspense>
      </Canvas>
    </div>
  );
}
