import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { City, DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from '../park/detail';

// T110 / FR-062: distant skyline (instanced low-poly blocks) + one recognisable landmark per city,
// built from primitives (no third-party models). Switching city needs no reload.

const SEEDS: Record<City, number> = { hanoi: 11, hcmc: 23, singapore: 37, tokyo: 41, newyork: 53 };
const TINT: Record<City, string> = { hanoi: '#c9c2b4', hcmc: '#bfc8cf', singapore: '#d7dde2', tokyo: '#cfd3dc', newyork: '#b7b2aa' };

function Blocks({ city, count }: { city: City; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const r = rng(SEEDS[city]);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const tall = city === 'newyork' || city === 'hcmc' ? 1.6 : city === 'hanoi' ? 0.8 : 1.2;
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = ROAD_RADIUS + 18 + r() * 70;
      const h = (8 + r() * r() * 55) * tall;
      const w = 5 + r() * 9;
      m.compose(
        new THREE.Vector3(Math.cos(a) * d, h / 2, Math.sin(a) * d),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI),
        new THREE.Vector3(w, h, w * (0.7 + r() * 0.6)),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(TINT[city]).offsetHSL(0, 0, (r() - 0.5) * 0.18));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [city, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} key={`${city}-${count}`}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.85} flatShading />
    </instancedMesh>
  );
}

const M = {
  glass: new THREE.MeshStandardMaterial({ color: '#8fb7d6', roughness: 0.25, metalness: 0.4 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.8 }),
  red: new THREE.MeshStandardMaterial({ color: '#e04b2b', roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 0.6 }),
  stone: new THREE.MeshStandardMaterial({ color: '#b9ad94', roughness: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: '#5aa4c8', roughness: 0.2, metalness: 0.1 }),
  roof: new THREE.MeshStandardMaterial({ color: '#7a3b2e', roughness: 0.8 }),
};

/** Hà Nội: Lotte Center (tall tower with an open top) + Tháp Rùa on Hồ Gươm. */
function Hanoi() {
  return (
    <group>
      <mesh material={M.glass} position={[0, 32, 0]}>
        <boxGeometry args={[12, 64, 9]} />
      </mesh>
      <mesh material={M.concrete} position={[0, 67, 0]}>
        <boxGeometry args={[12, 6, 9]} />
      </mesh>
      <group position={[-28, 0, 18]}>
        <mesh material={M.water} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
          <circleGeometry args={[14, 32]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={M.stone} position={[0, 1.5 + i * 2.6, 0]}>
            <boxGeometry args={[4 - i * 0.9, 2.4, 3 - i * 0.6]} />
          </mesh>
        ))}
        <mesh material={M.roof} position={[0, 9.4, 0]}>
          <coneGeometry args={[1.4, 1.6, 4]} />
        </mesh>
      </group>
    </group>
  );
}

/** TP.HCM: Landmark 81 — a bundle of stepped glass towers. */
function Hcmc() {
  const parts = [
    [0, 0, 6, 120],
    [6, 0, 5, 100],
    [-6, 0, 5, 95],
    [0, 6, 5, 105],
    [0, -6, 5, 90],
  ];
  return (
    <group>
      {parts.map(([x, z, w, h], i) => (
        <mesh key={i} material={M.glass} position={[x!, h! / 2, z!]}>
          <boxGeometry args={[w!, h!, w!]} />
        </mesh>
      ))}
      <mesh material={M.concrete} position={[0, 126, 0]}>
        <coneGeometry args={[3.5, 12, 4]} />
      </mesh>
    </group>
  );
}

/** Singapore: Marina Bay Sands — three towers and the SkyPark slab on top. */
function Singapore() {
  return (
    <group>
      {[-14, 0, 14].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={M.concrete} position={[-1.6, 28, 0]} rotation-z={0.06}>
            <boxGeometry args={[3.2, 56, 10]} />
          </mesh>
          <mesh material={M.glass} position={[1.6, 28, 0]} rotation-z={-0.06}>
            <boxGeometry args={[3.2, 56, 10]} />
          </mesh>
        </group>
      ))}
      <mesh material={M.white} position={[2, 57.5, 0]}>
        <boxGeometry args={[48, 2.5, 11]} />
      </mesh>
    </group>
  );
}

/** Tokyo: Tokyo Tower — red and white tapered lattice. */
function Tokyo() {
  const segs = 8;
  return (
    <group>
      {Array.from({ length: segs }, (_, i) => {
        const r0 = 9 * (1 - i / segs) ** 1.6 + 0.6;
        const r1 = 9 * (1 - (i + 1) / segs) ** 1.6 + 0.6;
        return (
          <mesh key={i} material={i % 2 ? M.white : M.red} position={[0, i * 10 + 5, 0]}>
            <cylinderGeometry args={[r1, r0, 10, 4, 1, true]} />
          </mesh>
        );
      })}
      <mesh material={M.white} position={[0, 34, 0]}>
        <boxGeometry args={[9, 3, 9]} />
      </mesh>
      <mesh material={M.red} position={[0, 92, 0]}>
        <cylinderGeometry args={[0.3, 0.6, 14, 6]} />
      </mesh>
    </group>
  );
}

/** New York: Empire State Building — stepped setbacks and a spire. */
function NewYork() {
  const steps = [
    [16, 30],
    [12, 22],
    [9, 30],
    [6, 10],
    [3.5, 6],
  ];
  let y = 0;
  return (
    <group>
      {steps.map(([w, h], i) => {
        const mesh = (
          <mesh key={i} material={M.stone} position={[0, y + h! / 2, 0]}>
            <boxGeometry args={[w!, h!, w! * 0.8]} />
          </mesh>
        );
        y += h!;
        return mesh;
      })}
      <mesh material={M.concrete} position={[0, y + 7, 0]}>
        <cylinderGeometry args={[0.25, 0.9, 14, 6]} />
      </mesh>
    </group>
  );
}

const LANDMARK: Record<City, () => React.JSX.Element> = { hanoi: Hanoi, hcmc: Hcmc, singapore: Singapore, tokyo: Tokyo, newyork: NewYork };

export function CitySkyline({ city, detail }: { city: City; detail: DetailLevel }) {
  const L = LANDMARK[city];
  return (
    <group>
      <Blocks city={city} count={DETAIL[detail].buildings} />
      {/* Landmark straight across the glass wall (north), so it is seen from inside the office. */}
      <group position={[0, 0, -(ROAD_RADIUS + 34)]}>
        <L />
      </group>
    </group>
  );
}
