import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DetailLevel } from '@shared/domain';
import { DETAIL, ROAD_RADIUS, rng } from './detail';
import { exerciseSpots, onPath, parkFrame } from './park-layout';

// T109 / FR-061: decorative walkers, joggers, people exercising and cars on fixed loops (no interaction).
// Low-poly instanced figures — one draw call per part; updated only while the scene is rendering.

type Kind = 'walk' | 'jog' | 'exercise';

export function Ambient({ detail, seed, rainy, floor }: { detail: DetailLevel; seed: number; rainy: boolean; floor: { width: number; depth: number } }) {
  const d = DETAIL[detail];
  // 002 T055: walkers follow the loop path round the office; the exercise group stands just outside it.
  const frame = useMemo(() => parkFrame(floor), [floor.width, floor.depth]);
  const people = Math.max(2, Math.round(d.walkers * (rainy ? 0.4 : 1))); // fewer people when it rains
  const agents = useMemo(() => {
    const r = rng(seed * 13 + 7);
    const spots = exerciseSpots(frame, Math.ceil(people / 5));
    let ex = 0;
    return Array.from({ length: people }, (_, i) => {
      const kind: Kind = i % 5 === 0 ? 'exercise' : i % 3 === 0 ? 'jog' : 'walk';
      return {
        kind,
        angle: r() * Math.PI * 2,
        lane: (r() - 0.5) * 1.0,
        speed: (kind === 'jog' ? 2.4 : 1.1) * (r() < 0.5 ? 1 : -1),
        color: new THREE.Color().setHSL(r(), 0.55, 0.55),
        // People exercising stand on the lawn doing jumping jacks.
        spot: kind === 'exercise' ? spots[ex++ % spots.length]! : { x: 0, z: 0 },
        phase: r() * 10,
      };
    });
  }, [people, seed, frame]);
  const cars = useMemo(() => {
    const r = rng(seed * 17 + 3);
    return Array.from({ length: d.cars }, (_, i) => ({
      angle: (i / d.cars) * Math.PI * 2 + r() * 0.3,
      lane: ROAD_RADIUS + (i % 2 ? 1.1 : -1.1),
      speed: (i % 2 ? 1 : -1) * (7 + r() * 4),
      color: new THREE.Color(['#e63946', '#f1faee', '#457b9d', '#ffb703', '#2a9d8f', '#1d3557'][i % 6]!),
    }));
  }, [d.cars, seed]);

  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const carMesh = useRef<THREE.InstancedMesh>(null);
  const cabin = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), y: new THREE.Vector3(0, 1, 0) }), []);
  const colored = useRef(false);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const { m, q, p, s, y } = tmp;
    const b = bodies.current;
    const h = heads.current;
    if (b && h) {
      agents.forEach((a, i) => {
        let x: number;
        let z: number;
        let bob = 0;
        let sy = 1;
        if (a.kind === 'exercise') {
          x = a.spot.x;
          z = a.spot.z;
          bob = Math.abs(Math.sin(t * 4 + a.phase)) * 0.25;
          sy = 1 - Math.abs(Math.sin(t * 4 + a.phase)) * 0.08;
        } else {
          a.angle += (a.speed / ((frame.rx + frame.rz) / 2)) * Math.min(dt, 0.1);
          const p = onPath(frame, a.angle, a.lane);
          x = p.x;
          z = p.z;
          bob = Math.abs(Math.sin(t * (a.kind === 'jog' ? 10 : 6) + a.phase)) * (a.kind === 'jog' ? 0.08 : 0.04);
        }
        q.setFromAxisAngle(y, -a.angle + (a.speed > 0 ? Math.PI : 0));
        s.set(1, sy, 1);
        p.set(x, 0.55 + bob, z);
        m.compose(p, q, s);
        b.setMatrixAt(i, m);
        p.set(x, 1.25 + bob, z);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        h.setMatrixAt(i, m);
        if (!colored.current) {
          b.setColorAt(i, a.color);
          h.setColorAt(i, new THREE.Color('#f2c9a0'));
        }
      });
      b.instanceMatrix.needsUpdate = true;
      h.instanceMatrix.needsUpdate = true;
      if (!colored.current) {
        if (b.instanceColor) b.instanceColor.needsUpdate = true;
        if (h.instanceColor) h.instanceColor.needsUpdate = true;
      }
    }
    const c = carMesh.current;
    const cb = cabin.current;
    if (c && cb) {
      cars.forEach((car, i) => {
        car.angle += (car.speed / car.lane) * Math.min(dt, 0.1);
        const x = Math.cos(car.angle) * car.lane;
        const z = Math.sin(car.angle) * car.lane;
        q.setFromAxisAngle(y, -car.angle + (car.speed > 0 ? 0 : Math.PI));
        s.set(1, 1, 1);
        p.set(x, 0.45, z);
        m.compose(p, q, s);
        c.setMatrixAt(i, m);
        p.set(x, 0.95, z);
        m.compose(p, q, s);
        cb.setMatrixAt(i, m);
        if (!colored.current) {
          c.setColorAt(i, car.color);
          cb.setColorAt(i, new THREE.Color('#cfe3f2'));
        }
      });
      c.instanceMatrix.needsUpdate = true;
      cb.instanceMatrix.needsUpdate = true;
      if (!colored.current) {
        if (c.instanceColor) c.instanceColor.needsUpdate = true;
        if (cb.instanceColor) cb.instanceColor.needsUpdate = true;
      }
    }
    colored.current = true;
  });

  return (
    <group key={`${people}-${d.cars}`}>
      <instancedMesh ref={bodies} args={[undefined, undefined, agents.length]} frustumCulled={false}>
        <capsuleGeometry args={[0.22, 0.6, 2, 6]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, agents.length]} frustumCulled={false}>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={carMesh} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry args={[1.8, 0.6, 3.8]} />
        <meshStandardMaterial roughness={0.5} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry args={[1.5, 0.5, 2]} />
        <meshStandardMaterial roughness={0.2} />
      </instancedMesh>
    </group>
  );
}
