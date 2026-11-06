import { useMemo } from 'react';
import type React from 'react';
import * as THREE from 'three';
import type { ItemType, PlacedItem } from '@shared/domain';
import { rotatedSize } from '@shared/catalog';
import type { OfficeGrid } from '../grid/grid';

// Procedural low-poly furniture (assets/LICENSES.md: no third-party files). Units: metres.

export const palette = {
  floor: '#d9cbb3',
  floorDark: '#3a3f4b',
  wall: '#f2efe9',
  wood: '#b98552',
  woodDark: '#7b5534',
  metal: '#5b6370',
  screen: '#1b2330',
  screenOn: '#4fa3ff',
  fabric: '#5b7db1',
  leaf: '#4f9d5d',
  pot: '#c96f4a',
  glass: '#a8d8f0',
};

const mats = {
  wood: new THREE.MeshStandardMaterial({ color: palette.wood, roughness: 0.8 }),
  woodDark: new THREE.MeshStandardMaterial({ color: palette.woodDark, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: palette.metal, roughness: 0.5, metalness: 0.3 }),
  screen: new THREE.MeshStandardMaterial({ color: palette.screen, roughness: 0.4 }),
  fabric: new THREE.MeshStandardMaterial({ color: palette.fabric, roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: palette.leaf, roughness: 0.9, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: palette.pot, roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ color: palette.wall, roughness: 0.95 }),
  glass: new THREE.MeshPhysicalMaterial({ color: palette.glass, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.35 }),
  water: new THREE.MeshStandardMaterial({ color: '#7fc8ff', transparent: true, opacity: 0.7 }),
};

function Box({ size, position, material }: { size: [number, number, number]; position: [number, number, number]; material: THREE.Material }) {
  return (
    <mesh position={position} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

/** Desk with a monitor; `screenOn` lights the monitor when the employee is working. */
export function Desk({ screenOn = false }: { screenOn?: boolean }) {
  const screenMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.screen, emissive: palette.screenOn, emissiveIntensity: 0 }),
    [],
  );
  screenMat.emissiveIntensity = screenOn ? 0.9 : 0.05;
  return (
    <group>
      <Box size={[1.4, 0.05, 0.75]} position={[0, 0.74, 0]} material={mats.wood} />
      {[
        [-0.65, -0.32],
        [0.65, -0.32],
        [-0.65, 0.32],
        [0.65, 0.32],
      ].map(([x, z], i) => (
        <Box key={i} size={[0.05, 0.72, 0.05]} position={[x!, 0.36, z!]} material={mats.metal} />
      ))}
      <Box size={[0.08, 0.25, 0.08]} position={[0, 0.88, -0.22]} material={mats.metal} />
      <mesh position={[0, 1.08, -0.2]} material={screenMat} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.03]} />
      </mesh>
      <Box size={[0.45, 0.02, 0.15]} position={[0, 0.775, 0.08]} material={mats.screen} />
    </group>
  );
}

export function Chair() {
  return (
    <group>
      <Box size={[0.45, 0.06, 0.45]} position={[0, 0.45, 0]} material={mats.fabric} />
      <Box size={[0.45, 0.3, 0.06]} position={[0, 0.63, 0.24]} material={mats.fabric} />
      <Box size={[0.05, 0.42, 0.05]} position={[0, 0.21, 0]} material={mats.metal} />
    </group>
  );
}

export function Plant() {
  return (
    <group>
      <mesh position={[0, 0.18, 0]} material={mats.pot} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.36, 8]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} material={mats.leaf} castShadow>
        <icosahedronGeometry args={[0.32, 0]} />
      </mesh>
      <mesh position={[0.1, 0.9, 0.05]} material={mats.leaf} castShadow>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
    </group>
  );
}

export function WaterCooler() {
  return (
    <group>
      <Box size={[0.36, 0.9, 0.36]} position={[0, 0.45, 0]} material={mats.wall} />
      <mesh position={[0, 1.08, 0]} material={mats.water} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.36, 12]} />
      </mesh>
    </group>
  );
}

export function Sofa() {
  return (
    <group>
      <Box size={[1.9, 0.4, 0.8]} position={[0, 0.2, 0]} material={mats.fabric} />
      <Box size={[1.9, 0.5, 0.2]} position={[0, 0.6, -0.3]} material={mats.fabric} />
      <Box size={[0.2, 0.35, 0.8]} position={[-0.85, 0.55, 0]} material={mats.fabric} />
      <Box size={[0.2, 0.35, 0.8]} position={[0.85, 0.55, 0]} material={mats.fabric} />
    </group>
  );
}

export function WallScreenFrame() {
  return <Box size={[1.4, 0.8, 0.05]} position={[0, 1.6, 0]} material={mats.screen} />;
}

export function Door() {
  return <Box size={[0.95, 0.06, 0.5]} position={[0, 0.03, 0]} material={mats.woodDark} />;
}

const WALL_H = 2.6;

/** Walls and glass are drawn as thin panels on the north or west edge of their cell. */
/** In the overview ("dollhouse") camera, solid walls are cut down so they never hide the office. */
export const CUTAWAY_WALL_H = 0.45;

export function EdgePanel({
  type,
  rotation,
  cellSize,
  cutaway = true,
}: {
  type: 'wall' | 'glass_wall';
  rotation: number;
  cellSize: number;
  cutaway?: boolean;
}) {
  const vertical = rotation === 90 || rotation === 270;
  const h = type === 'wall' && cutaway ? CUTAWAY_WALL_H : WALL_H;
  const pos: [number, number, number] = vertical ? [-cellSize / 2, h / 2, 0] : [0, h / 2, -cellSize / 2];
  const size: [number, number, number] = vertical ? [0.08, h, cellSize] : [cellSize, h, 0.08];
  return <Box size={size} position={pos} material={type === 'glass_wall' ? mats.glass : mats.wall} />;
}

/** Position of an item's group: centre of its rotated footprint. */
export function itemTransform(item: PlacedItem, grid: OfficeGrid): { position: [number, number, number]; rotationY: number } {
  const { w, d } = rotatedSize(item.type, item.rotation);
  const [x0, , z0] = grid.toWorld(item.cell);
  const s = grid.cellSize;
  const edge = item.type === 'wall' || item.type === 'glass_wall';
  return {
    position: edge ? [x0, 0, z0] : [x0 + ((w - 1) * s) / 2, 0, z0 + ((d - 1) * s) / 2],
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
