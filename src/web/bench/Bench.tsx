import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef } from 'react';
import type { Employee, VisualState } from '@shared/domain';
import { defaultBenchLayout } from './bench-layout';
import { OfficeScene } from '../scene/OfficeScene';
import { useEmployees } from '../state/employees';
import { useConnection } from '../state/connection';
import { useSettings } from '../state/settings';
import { useWeather } from '../state/weather';
import { BRAINS } from '../scene/Employee';
import type { DetailLevel } from '@shared/domain';

// T058 / SC-004: 20 fake employees whose state changes every 2 s in the default office, with a fixed
// camera flight. Exposes window.__bench = { frames: number[] } for scripts/bench-fps.ts.

const STATES: VisualState[] = ['idle', 'working', 'thinking', 'waiting_for_boss', 'error', 'stopped'];
/** Scenarios understood by ?scenario= (T003). */
const KNOWN_SCENARIOS: string[] = ['crowd', 'outing', 'rooms'];

const APPEARANCES = ['worker-a', 'worker-b', 'worker-c', 'worker-d', 'worker-e', 'worker-f', 'worker-g', 'worker-h'];

declare global {
  interface Window {
    __bench?: { frames: number[]; startedAt: number; overlaps?: number; crowdMs?: number[] };
    __crowd?: import('../scene/crowd/crowd').Crowd;
  }
}

/** T047: count pairs closer than their radii allow (must stay 0). */
function countOverlaps(): number {
  const agents = window.__crowd?.all() ?? [];
  let n = 0;
  for (let i = 0; i < agents.length; i++)
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i]!;
      const b = agents[j]!;
      const ra = a.seated ? 0.2 : 0.28;
      const rb = b.seated ? 0.2 : 0.28;
      if (Math.hypot(a.x - b.x, a.z - b.z) < ra + rb - 0.01) n++;
    }
  return n;
}

function fakeEmployees(tick: number, deskIds: string[], allIdle = false): Employee[] {
  return Array.from({ length: 20 }, (_, i) => ({
    conversationId: `bench-${i}`,
    name: `Employee ${i + 1}`,
    visualState: allIdle ? 'idle' : STATES[(i + tick) % STATES.length]!,
    appearance: APPEARANCES[i % APPEARANCES.length]!,
    deskId: deskIds[i] ?? null,
    meetingSeatId: null,
    projectId: `p${i % 3}`,
    projectColor: ['#e4572e', '#2f6fed', '#2ec4b6'][i % 3]!,
    isSubagent: false,
    parentId: null,
    visible: true,
    lastActivityAt: new Date().toISOString(),
    preferredModel: null,
    currentModel: null,
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
    if (b) {
      b.frames.push(performance.now());
      if (b.overlaps !== undefined) b.overlaps += countOverlaps();
    }
  });
  return null;
}

function benchFloor(): { width: number; depth: number } | undefined {
  const m = /^(\d+)x(\d+)$/.exec(new URLSearchParams(location.search).get('floor') ?? '');
  if (!m) return undefined;
  const clamp = (v: number) => Math.min(40, Math.max(16, v));
  return { width: clamp(Number(m[1])), depth: clamp(Number(m[2])) };
}

export function Bench() {
  // 004 T042 "outing": all 20 idle, dry weather, a sofa, breaks every 10 s → sofa rests and shop trips
  // up to the outing cap (a third of the staff outside) while the FPS is measured.
  const outing = new URLSearchParams(location.search).get('scenario') === 'outing';
  const rooms = new URLSearchParams(location.search).get('scenario') === 'rooms';
  const layout = defaultBenchLayout(benchFloor() ?? (rooms ? { width: 24, depth: 16 } : undefined), { sofa: outing, rooms });
  const deskIds = layout.items.filter((i) => i.type === 'desk').map((d) => d.id);

  useEffect(() => {
    // T115: full scene — park, people, cars, skyline and rain — at ?detail= (default medium).
    const params = new URLSearchParams(location.search);
    const q = params.get('detail');
    // T003: scenarios and floor sizes are added by later phases (crowd: US3, floor: US4).
    const scenario = params.get('scenario');
    if (scenario && !KNOWN_SCENARIOS.includes(scenario)) console.warn(`bench: unknown scenario "${scenario}", using default`);
    const floor = params.get('floor');
    if (floor && !/^\d+x\d+$/.test(floor)) console.warn(`bench: bad floor "${floor}", expected WxD in metres`);
    const detail: DetailLevel = q === 'low' || q === 'high' ? q : 'medium';
    useSettings.getState().set({ detailLevel: detail, city: 'hanoi', theme: 'light', autoLowerDetail: false });
    useWeather.getState().set({ city: 'hanoi', condition: outing ? 'clear' : 'rain', isDay: true, temperatureC: 26, fetchedAt: new Date().toISOString(), source: 'open-meteo' });
    useConnection.getState().setServerOnline(true);
    useConnection.getState().setApp({ kind: 'connected', appVersion: 'bench', versionSupported: true, verifiedVersions: [] });
    let tick = 0;
    const idle = scenario === 'crowd' || outing;
    useEmployees.getState().snapshot(fakeEmployees(tick, deskIds, idle), 0);
    window.__bench = { frames: [], startedAt: performance.now(), ...(idle ? { overlaps: 0 } : {}) };
    const tuned = new WeakSet<object>();
    const id = setInterval(() => {
      tick++;
      useEmployees.getState().snapshot(fakeEmployees(tick, deskIds, idle), 0);
      if (outing)
        for (const b of BRAINS.values())
          if (!tuned.has(b)) {
            tuned.add(b);
            b.setBreakInterval(10_000);
          }
    }, 2000);
    return () => clearInterval(id);
  }, []); // once, on mount

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
