import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type * as THREE from 'three';
import type { DetailLevel } from '@shared/domain';
import { createTraffic, stepTraffic, type Vehicle } from './Traffic';

// 002 US7 / T085 / FR-042: the ring-road traffic drawn — rounded cars, a green city bus, motorbikes with
// helmeted riders; headlights and tail lights glow at night. Movement comes from Traffic.ts (no overlaps).

function Lights({ x, night, front }: { x: number; night: boolean; front: boolean }) {
  const color = front ? '#fff6d8' : '#e0322a';
  return (
    <>
      {[0.55, -0.55].map((z) => (
        <mesh key={z} position={[x, 0.78, z]}>
          <boxGeometry args={[0.06, 0.14, 0.3]} />
          <meshStandardMaterial color={color} emissive={night ? color : '#000000'} emissiveIntensity={night ? 4 : 0} />
        </mesh>
      ))}
    </>
  );
}

function Wheel({ x, z, r, w }: { x: number; z: number; r: number; w: number }) {
  return (
    <mesh position={[x, r, z]} rotation-x={Math.PI / 2}>
      <cylinderGeometry args={[r, r, w, 16]} />
      <meshStandardMaterial color="#1f1f22" roughness={0.8} />
    </mesh>
  );
}

function Car({ v, night }: { v: Vehicle; night: boolean }) {
  return (
    <group>
      <RoundedBox args={[4, 0.7, 1.8]} radius={0.25} smoothness={3} position={[0, 0.68, 0]}>
        <meshStandardMaterial color={v.color} roughness={0.35} metalness={0.3} />
      </RoundedBox>
      <RoundedBox args={[2.2, 0.62, 1.62]} radius={0.22} smoothness={3} position={[-0.25, 1.28, 0]}>
        <meshStandardMaterial color="#2c3b45" roughness={0.12} metalness={0.4} />
      </RoundedBox>
      {[
        [1.3, 0.82],
        [1.3, -0.82],
        [-1.3, 0.82],
        [-1.3, -0.82],
      ].map(([x, z], i) => (
        <Wheel key={i} x={x!} z={z!} r={0.33} w={0.24} />
      ))}
      <Lights x={2.0} night={night} front />
      <Lights x={-2.0} night={night} front={false} />
    </group>
  );
}

function Bus({ night }: { night: boolean }) {
  return (
    <group>
      <RoundedBox args={[10, 2.5, 2.5]} radius={0.35} smoothness={3} position={[0, 1.6, 0]}>
        <meshStandardMaterial color="#3a9a5a" roughness={0.45} metalness={0.2} />
      </RoundedBox>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[9.4, 0.85, 2.54]} />
        <meshStandardMaterial color={night ? '#3a3020' : '#2c3b45'} roughness={0.15} emissive={night ? '#ffd99a' : '#000000'} emissiveIntensity={night ? 0.8 : 0} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[9.6, 0.18, 2.54]} />
        <meshStandardMaterial color="#f2c14e" />
      </mesh>
      {[
        [3.4, 1.15],
        [3.4, -1.15],
        [-3.4, 1.15],
        [-3.4, -1.15],
      ].map(([x, z], i) => (
        <Wheel key={i} x={x!} z={z!} r={0.5} w={0.3} />
      ))}
      <Lights x={5.0} night={night} front />
      <Lights x={-5.0} night={night} front={false} />
    </group>
  );
}

function Moto({ v, night }: { v: Vehicle; night: boolean }) {
  return (
    <group>
      <RoundedBox args={[1.3, 0.32, 0.3]} radius={0.12} smoothness={2} position={[0, 0.58, 0]}>
        <meshStandardMaterial color={v.color} roughness={0.4} metalness={0.3} />
      </RoundedBox>
      <Wheel x={0.62} z={0} r={0.3} w={0.1} />
      <Wheel x={-0.62} z={0} r={0.3} w={0.1} />
      <mesh position={[0.72, 0.85, 0]}>
        <boxGeometry args={[0.06, 0.12, 0.14]} />
        <meshStandardMaterial color="#fff6d8" emissive={night ? '#fff6d8' : '#000000'} emissiveIntensity={night ? 5 : 0} />
      </mesh>
      <mesh position={[-0.15, 1.18, 0]} rotation-z={-0.2}>
        <capsuleGeometry args={[0.15, 0.32, 6, 12]} />
        <meshStandardMaterial color={v.rider!.shirt} roughness={0.8} />
      </mesh>
      <mesh position={[-0.08, 1.62, 0]}>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color={v.rider!.helmet} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function TrafficView({ seed, detail, night }: { seed: number; detail: DetailLevel; night: boolean }) {
  const vehicles = useMemo(() => createTraffic(seed, detail), [seed, detail]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    stepTraffic(vehicles, Math.min(dt, 0.1));
    vehicles.forEach((v, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(Math.cos(v.angle) * v.radius, 0, Math.sin(v.angle) * v.radius);
      // Models face +x; point them along the direction of travel (tangent of the ring).
      g.rotation.y = -v.angle - (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    });
  });
  return (
    <group>
      {vehicles.map((v, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          {v.kind === 'car' ? <Car v={v} night={night} /> : v.kind === 'bus' ? <Bus night={night} /> : <Moto v={v} night={night} />}
        </group>
      ))}
    </group>
  );
}
