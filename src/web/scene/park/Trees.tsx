import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { City, DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from './detail';
import { treeAllowed, treeCandidates, type ParkFrame } from './park-layout';

// 002 US7 / T082 / FR-039: trees that read as trees — broad canopies made of several leaf clumps in four
// greens on a trunk, flowering trees (phượng in Việt Nam, cherry in Tokyo…), and a row of the city's
// street tree along the road (coconut palms in Việt Nam and Singapore). Everything is instanced: a few
// draw calls for the whole park. Trees come from one fixed set; the office size only hides some (T055).

type Kind = 'canopy' | 'flower' | 'palm';

const BLOSSOM: Record<City, string> = { hanoi: '#e0503a', hcmc: '#e0503a', singapore: '#e86fa0', tokyo: '#f6b8c8', newyork: '#f4f1e6' };
const ROW_TREE: Record<City, Kind> = { hanoi: 'palm', hcmc: 'palm', singapore: 'palm', tokyo: 'flower', newyork: 'canopy' };
const PALMS: Record<City, boolean> = { hanoi: true, hcmc: true, singapore: true, tokyo: false, newyork: false };
const GREENS = ['#3d7f3f', '#4a8c47', '#336f37', '#5a9a52'];

interface Tree {
  x: number;
  z: number;
  s: number;
  rot: number;
  kind: Kind;
  h: number;
}

function useInstanced(count: number, fill: (i: number, m: THREE.Matrix4, c: THREE.Color) => void, deps: unknown[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      fill(i, m, c);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, deps); // re-filled when the tree set changes
  return ref;
}

export function Trees({ city, detail, seed, frame }: { city: City; detail: DetailLevel; seed: number; frame: ParkFrame }) {
  const clumpsPerTree = detail === 'low' ? 4 : detail === 'medium' ? 7 : 10;
  const trees = useMemo<Tree[]>(() => {
    const r = rng(seed * 59 + 5);
    const count = DETAIL[detail].trees;
    const park = treeCandidates(seed * 31, count * 2)
      .filter((t) => treeAllowed(frame, t.x, t.z))
      .slice(0, count)
      .map((t) => {
        const k = r();
        const kind: Kind = k < 0.65 ? 'canopy' : k < 0.85 || !PALMS[city] ? 'flower' : 'palm';
        return { ...t, kind, h: 2.3 + r() * 1.2 };
      });
    // Street trees along the inside of the road.
    const row: Tree[] = [];
    const rr = ROAD_RADIUS - 4;
    const n = Math.floor((2 * Math.PI * rr) / 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      if (Math.abs(x) < 2.2 || Math.abs(z) < 2.2) continue; // keep the spokes free
      row.push({ x, z, s: 0.95 + r() * 0.15, rot: r() * Math.PI, kind: ROW_TREE[city], h: 2.6 + r() * 0.6 });
    }
    return [...park, ...row];
  }, [city, detail, seed, frame]);

  const leafy = useMemo(() => trees.filter((t) => t.kind !== 'palm'), [trees]);
  const palms = useMemo(() => trees.filter((t) => t.kind === 'palm'), [trees]);
  const clumps = useMemo(() => {
    const r = rng(seed * 101 + 9);
    return leafy.flatMap((t) =>
      Array.from({ length: clumpsPerTree }, (_, i) => {
        const a = r() * Math.PI * 2;
        const rad = (0.2 + r() * 1.25) * t.s;
        const blossom = t.kind === 'flower' && r() < 0.6;
        return {
          x: t.x + Math.cos(a) * rad,
          y: (t.h + 0.55 + r() * 1.3 - rad * 0.35) * t.s,
          z: t.z + Math.sin(a) * rad,
          size: (0.5 + r() * 0.45) * t.s,
          color: blossom ? BLOSSOM[city] : GREENS[i % GREENS.length]!,
        };
      }),
    );
  }, [leafy, clumpsPerTree, seed, city]);
  const fronds = useMemo(() => palms.flatMap((t) => Array.from({ length: 9 }, (_, i) => ({ t, a: (i / 9) * Math.PI * 2 + t.rot, droop: 0.35 + ((i * 7) % 5) * 0.06 }))), [palms]);

  const trunks = useInstanced(
    trees.length,
    (i, m, c) => {
      const t = trees[i]!;
      const h = t.kind === 'palm' ? 5.2 * t.s : t.h * t.s;
      m.compose(new THREE.Vector3(t.x, h / 2, t.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, t.kind === 'palm' ? 0.06 : 0)), new THREE.Vector3(t.s, h, t.s));
      c.set(t.kind === 'palm' ? '#8a6e52' : '#6b5442');
    },
    [trees],
  );
  const leaves = useInstanced(
    clumps.length,
    (i, m, c) => {
      const k = clumps[i]!;
      m.compose(new THREE.Vector3(k.x, k.y, k.z), new THREE.Quaternion(), new THREE.Vector3(k.size, k.size * 0.72, k.size));
      c.set(k.color);
    },
    [clumps],
  );
  const palmLeaves = useInstanced(
    fronds.length,
    (i, m, c) => {
      const f = fronds[i]!;
      const top = 5.2 * f.t.s;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -f.a, -f.droop, 'YXZ'));
      const dir = new THREE.Vector3(Math.cos(f.a), -f.droop * 0.8, Math.sin(f.a)).multiplyScalar(1.1 * f.t.s);
      m.compose(new THREE.Vector3(f.t.x + dir.x, top + dir.y, f.t.z + dir.z), q, new THREE.Vector3(1.3 * f.t.s, 0.08, 0.3 * f.t.s));
      c.set(i % 2 ? '#4a8c47' : '#3d7f3f');
    },
    [fronds],
  );

  return (
    <group key={`${trees.length}-${clumps.length}`}>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow={false}>
        <cylinderGeometry args={[0.1, 0.17, 1, 8]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, clumps.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={palmLeaves} args={[undefined, undefined, Math.max(1, fronds.length)]} visible={fronds.length > 0}>
        <sphereGeometry args={[1, 12, 6]} />
        <meshStandardMaterial roughness={0.8} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
