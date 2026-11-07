import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DetailLevel, WeatherCondition } from '@shared/domain';
import { DETAIL, rng } from '../park/detail';

// T111 / FR-063: sky colour, fog, clouds, rain (instanced streaks), storm flashes, mist.

export const SKY: Record<'light' | 'dark', Record<WeatherCondition, string>> = {
  light: { clear: '#a9d4f5', cloudy: '#c3ccd6', rain: '#9aa6b2', storm: '#6d7682', fog_snow: '#d6dbe0' },
  dark: { clear: '#0f1a2e', cloudy: '#151c28', rain: '#121821', storm: '#0b0f16', fog_snow: '#1c222b' },
};

/** Sun/ambient multiplier per condition (used by OfficeMood). */
export const LIGHT_FACTOR: Record<WeatherCondition, number> = { clear: 1, cloudy: 0.75, rain: 0.6, storm: 0.45, fog_snow: 0.7 };

function Clouds({ count, dark, seed }: { count: number; dark: boolean; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ a: r() * Math.PI * 2, d: 30 + r() * 70, y: 38 + r() * 15, s: 6 + r() * 8, v: 0.01 + r() * 0.02 }));
  }, [count, seed]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((c, i) => {
      c.a += c.v * Math.min(dt, 0.1);
      m.compose(new THREE.Vector3(Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d), new THREE.Quaternion(), new THREE.Vector3(c.s * 1.8, c.s * 0.5, c.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={dark ? '#3a4352' : '#f4f6f8'} roughness={1} flatShading transparent opacity={0.92} />
    </instancedMesh>
  );
}

function Rain({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * 70, z: (r() - 0.5) * 70, y: r() * 30, v: 18 + r() * 8 }));
  }, [count]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    drops.forEach((d, i) => {
      m.makeTranslation(d.x, d.y, d.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [drops, m]);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    const step = Math.min(dt, 0.1);
    drops.forEach((d, i) => {
      d.y -= d.v * step;
      // Rain stays outside the office roof area.
      if (d.y < 0 || (Math.abs(d.x) < 8.5 && Math.abs(d.z) < 6.5 && d.y < 3)) d.y = 30;
      m.makeTranslation(d.x, d.y, d.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.03, 0.6, 0.03]} />
      <meshBasicMaterial color="#b9d4ee" transparent opacity={0.55} />
    </instancedMesh>
  );
}

function Lightning() {
  const light = useRef<THREE.AmbientLight>(null);
  const next = useRef(3);
  useFrame(({ clock }) => {
    const l = light.current;
    if (!l) return;
    const t = clock.elapsedTime;
    if (t > next.current) {
      l.intensity = 2.5;
      next.current = t + 4 + Math.random() * 8;
    } else l.intensity = Math.max(0, l.intensity - 0.15);
  });
  return <ambientLight ref={light} intensity={0} color="#dfe8ff" />;
}

export function Weather({ condition, theme, detail }: { condition: WeatherCondition; theme: 'light' | 'dark'; detail: DetailLevel }) {
  const scene = useThree((s) => s.scene);
  const sky = SKY[theme][condition];
  useLayoutEffect(() => {
    scene.background = new THREE.Color(sky);
    const near = condition === 'fog_snow' ? 25 : condition === 'storm' || condition === 'rain' ? 50 : 90;
    scene.fog = new THREE.Fog(sky, near, near + 120);
    return () => {
      scene.fog = null;
    };
  }, [scene, sky, condition]);
  const d = DETAIL[detail];
  const cloudCount = condition === 'clear' ? Math.round(d.clouds / 3) : d.clouds;
  return (
    <group>
      <Clouds count={cloudCount} dark={theme === 'dark' || condition === 'storm'} seed={condition.length * 7} />
      {(condition === 'rain' || condition === 'storm') && <Rain count={d.rain} />}
      {condition === 'storm' && <Lightning />}
    </group>
  );
}
