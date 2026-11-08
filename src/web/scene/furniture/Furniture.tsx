import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CONCEPT, limewashTexture } from '../../theme/concept';
import type React from 'react';
import * as THREE from 'three';
import type { ItemType, OfficeLayout, PlacedItem } from '@shared/domain';
import { footprintRect, isEdge } from '@shared/catalog';

// Procedural furniture in the chosen concept E+ (002 US6 / T071): soft rounded shapes, PBR materials,
// cream desks on teal legs, rattan chairs, terracotta pots. No third-party files (assets/LICENSES.md).
// Units: metres.

/** Kept for callers that still pick a floor colour; the floor itself is a wood texture (Office.tsx). */
export const palette = {
  floor: CONCEPT.floor.a,
  floorDark: CONCEPT.floor.dark.a,
};

const R = CONCEPT.rounded;
const mats = {
  deskTop: new THREE.MeshStandardMaterial({ color: CONCEPT.deskTop, roughness: 0.45 }),
  leg: new THREE.MeshStandardMaterial({ color: CONCEPT.deskLeg, roughness: 0.5 }),
  monitor: new THREE.MeshStandardMaterial({ color: CONCEPT.monitor, roughness: 0.4, metalness: 0.2 }),
  keyboard: new THREE.MeshStandardMaterial({ color: '#e8e1d2', roughness: 0.6 }),
  rattan: new THREE.MeshStandardMaterial({ color: CONCEPT.chair, roughness: 0.85 }),
  chairFrame: new THREE.MeshStandardMaterial({ color: CONCEPT.chairFrame, roughness: 0.5 }),
  sofa: new THREE.MeshStandardMaterial({ color: CONCEPT.sofa, roughness: 0.9 }),
  cushion: new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: CONCEPT.plant, roughness: 0.75, side: THREE.DoubleSide }),
  leafLight: new THREE.MeshStandardMaterial({ color: '#3f8f52', roughness: 0.75, side: THREE.DoubleSide }),
  stem: new THREE.MeshStandardMaterial({ color: '#5a7a3a', roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: CONCEPT.pot, roughness: 0.85 }),
  cooler: new THREE.MeshStandardMaterial({ color: CONCEPT.cooler, roughness: 0.5 }),
  water: new THREE.MeshPhysicalMaterial({ color: CONCEPT.water, roughness: 0.05, transmission: 0.5, transparent: true, opacity: 0.7 }),
  wall: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }),
  frame: new THREE.MeshStandardMaterial({ color: CONCEPT.frame, roughness: 0.5 }),
  glass: new THREE.MeshPhysicalMaterial({ color: CONCEPT.glass, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.25 }),
  mat: new THREE.MeshStandardMaterial({ color: CONCEPT.doorMat, roughness: 0.95 }),
};
let wallTextured = false;
function wallMaterial(): THREE.Material {
  if (!wallTextured && typeof document !== 'undefined') {
    mats.wall.map = limewashTexture();
    mats.wall.needsUpdate = true;
    wallTextured = true;
  }
  return mats.wall;
}

/** A softly rounded box (concept E). */
function Box({ size, position, material, radius = R }: { size: [number, number, number]; position: [number, number, number]; material: THREE.Material; radius?: number }) {
  const r = Math.max(0.002, Math.min(radius, Math.min(...size) / 2 - 0.002));
  return <RoundedBox args={size} radius={r} smoothness={3} position={position} material={material} castShadow receiveShadow />;
}

function Cyl({ r, h, position, material, rTop = r, seg = 20 }: { r: number; h: number; position: [number, number, number]; material: THREE.Material; rTop?: number; seg?: number }) {
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, r, h, seg]} />
    </mesh>
  );
}

/** Desk with a monitor; `screenOn` lights the monitor when the employee is working. */
export function Desk({ screenOn = false }: { screenOn?: boolean }) {
  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f1c19', emissive: CONCEPT.screenOn, emissiveIntensity: 0 }), []);
  screenMat.emissiveIntensity = screenOn ? 0.9 : 0.05;
  return (
    <group>
      <Box size={[1.45, 0.05, 0.75]} position={[0, 0.74, 0]} material={mats.deskTop} radius={0.025} />
      {[
        [-0.64, -0.28],
        [0.64, -0.28],
        [-0.64, 0.28],
        [0.64, 0.28],
      ].map(([x, z], i) => (
        <Cyl key={i} r={0.04} h={0.72} position={[x!, 0.36, z!]} material={mats.leg} seg={14} />
      ))}
      <Cyl r={0.02} h={0.16} position={[0, 0.84, -0.22]} material={mats.monitor} seg={10} />
      <Box size={[0.22, 0.015, 0.14]} position={[0, 0.775, -0.22]} material={mats.monitor} radius={0.006} />
      <Box size={[0.66, 0.38, 0.035]} position={[0, 1.08, -0.2]} material={mats.monitor} radius={0.02} />
      <mesh position={[0, 1.08, -0.18]} material={screenMat}>
        <planeGeometry args={[0.6, 0.32]} />
      </mesh>
      <Box size={[0.42, 0.02, 0.13]} position={[0, 0.775, 0.1]} material={mats.keyboard} radius={0.008} />
      <Cyl r={0.04} rTop={0.045} h={0.1} position={[0.5, 0.815, 0.05]} material={mats.pot} seg={14} />
    </group>
  );
}

/** Rattan chair (concept D colours, E shapes). */
export function Chair() {
  return (
    <group>
      <Box size={[0.48, 0.07, 0.46]} position={[0, 0.45, 0]} material={mats.rattan} radius={0.03} />
      <Box size={[0.46, 0.42, 0.06]} position={[0, 0.7, 0.22]} material={mats.rattan} radius={0.03} />
      {[
        [-0.2, -0.18],
        [0.2, -0.18],
        [-0.2, 0.18],
        [0.2, 0.18],
      ].map(([x, z], i) => (
        <Cyl key={i} r={0.02} h={0.42} position={[x!, 0.21, z!]} material={mats.chairFrame} seg={8} />
      ))}
    </group>
  );
}

/** Tropical plant in a terracotta pot. */
export function Plant() {
  const leaves = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return { a, y: 0.62 + (i % 3) * 0.16, light: i % 2 === 0 };
      }),
    [],
  );
  return (
    <group>
      <Cyl r={0.14} rTop={0.19} h={0.36} position={[0, 0.18, 0]} material={mats.pot} />
      <Cyl r={0.012} rTop={0.012} h={0.7} position={[0, 0.6, 0]} material={mats.stem} seg={6} />
      {leaves.map((l, i) => (
        <mesh
          key={i}
          material={l.light ? mats.leafLight : mats.leaf}
          position={[Math.cos(l.a) * 0.16, l.y, Math.sin(l.a) * 0.16]}
          rotation={[0.5 * Math.sin(l.a), -l.a, 0.55]}
          scale={[0.22, 0.04, 0.12]}
          castShadow
        >
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
      ))}
    </group>
  );
}

export function WaterCooler() {
  return (
    <group>
      <Box size={[0.36, 0.9, 0.36]} position={[0, 0.45, 0]} material={mats.cooler} radius={0.05} />
      <mesh position={[0, 1.08, 0]} material={mats.water} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.36, 20]} />
      </mesh>
    </group>
  );
}

export function Sofa() {
  return (
    <group>
      <Box size={[1.9, 0.4, 0.8]} position={[0, 0.22, 0]} material={mats.sofa} radius={0.08} />
      <Box size={[1.9, 0.5, 0.22]} position={[0, 0.6, -0.29]} material={mats.sofa} radius={0.08} />
      <Box size={[0.22, 0.36, 0.8]} position={[-0.84, 0.56, 0]} material={mats.sofa} radius={0.08} />
      <Box size={[0.22, 0.36, 0.8]} position={[0.84, 0.56, 0]} material={mats.sofa} radius={0.08} />
      <Box size={[0.7, 0.12, 0.55]} position={[-0.36, 0.47, 0.06]} material={mats.cushion} radius={0.05} />
      <Box size={[0.7, 0.12, 0.55]} position={[0.36, 0.47, 0.06]} material={mats.cushion} radius={0.05} />
    </group>
  );
}

export function WallScreenFrame() {
  return <Box size={[1.4, 0.8, 0.05]} position={[0, 1.6, 0]} material={mats.monitor} radius={0.03} />;
}

export function Door() {
  return <Box size={[0.95, 0.03, 0.5]} position={[0, 0.015, 0]} material={mats.mat} radius={0.01} />;
}

const WALL_H = 2.6;

/** In the overview ("dollhouse") camera, solid walls are cut down so they never hide the office. */
export const CUTAWAY_WALL_H = 0.45;

/** A wall or glass panel centred on its group; `vertical` runs along z (west/east), else along x. */
export function EdgePanel({
  type,
  vertical,
  length,
  cutaway = true,
}: {
  type: 'wall' | 'glass_wall';
  vertical: boolean;
  length: number;
  cutaway?: boolean;
}) {
  const h = type === 'wall' && cutaway ? CUTAWAY_WALL_H : WALL_H;
  const size: [number, number, number] = vertical ? [0.08, h, length] : [length, h, 0.08];
  return <Box size={size} position={[0, h / 2, 0]} material={type === 'glass_wall' ? mats.glass : wallMaterial()} radius={0.03} />;
}

/** Floor space (metres from the north-west corner) → world (floor centred on the origin). */
export function floorToWorld(floor: OfficeLayout['floor'], x: number, z: number): [number, number, number] {
  return [x - floor.width / 2, 0, z - floor.depth / 2];
}

/** Position of an item's group: centre of its rotated footprint (edge items: centre of the segment). */
export function itemTransform(item: PlacedItem, floor: OfficeLayout['floor']): { position: [number, number, number]; rotationY: number } {
  const r = footprintRect(item);
  const edge = isEdge(item.type);
  return {
    position: floorToWorld(floor, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2),
    rotationY: edge ? 0 : -(item.rotation * Math.PI) / 180,
  };
}

export const furnitureFor: Partial<Record<ItemType, () => React.JSX.Element>> = {
  chair: Chair,
  plant: Plant,
  water_cooler: WaterCooler,
  sofa: Sofa,
  wall_screen: WallScreenFrame,
  door: Door,
};
