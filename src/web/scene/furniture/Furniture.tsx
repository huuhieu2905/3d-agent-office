import { useEffect, useMemo, useRef, useState } from 'react';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEmployees } from '../../state/employees';
import { CONCEPT, defaultPictureTexture, limewashTexture } from '../../theme/concept';
import type React from 'react';
import * as THREE from 'three';
import type { ItemType, OfficeLayout, PlacedItem } from '@shared/domain';
import { CATALOG, CELL, footprintRect, isEdge, isWallMounted, seatPoints } from '@shared/catalog';
import { coverFit, loadPictureTexture } from '../../ui/build/picture';

// Procedural furniture in the chosen concept E+ (002 US6 / T071): soft rounded shapes, PBR materials,
// cream desks on teal legs, office chairs (007), terracotta pots. No third-party files (assets/LICENSES.md).
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
  chairFrame: new THREE.MeshStandardMaterial({ color: CONCEPT.chairFrame, roughness: 0.5 }),
  chairBase: new THREE.MeshStandardMaterial({ color: '#3b3a38', roughness: 0.45, metalness: 0.3 }),
  fabric: new THREE.MeshStandardMaterial({ color: CONCEPT.fabric, roughness: 0.9 }),
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

/**
 * 007 US4: ergonomic office chair — five-point base on casters, gas lift, padded seat, high back (behind the
 * sitter, +z like the old rattan chair) and armrests. Seat top ≈ 0.49 m, same height as before, so seated
 * employees keep their pose.
 */
const CASTERS = [0, 1, 2, 3, 4].map((i) => {
  const a = (i / 5) * Math.PI * 2;
  return [Math.sin(a) * 0.27, Math.cos(a) * 0.27] as const;
});
export function Chair() {
  return (
    <group>
      {/* Five-point base: a flat pentagonal star plus one caster under each point. */}
      <Cyl r={0.29} rTop={0.06} h={0.05} position={[0, 0.075, 0]} material={mats.chairBase} seg={5} />
      {CASTERS.map(([x, z], i) => (
        <Cyl key={i} r={0.025} h={0.04} position={[x, 0.025, z]} material={mats.chairBase} seg={8} />
      ))}
      <Cyl r={0.025} h={0.3} position={[0, 0.25, 0]} material={mats.chairFrame} seg={10} />
      <Box size={[0.48, 0.08, 0.46]} position={[0, 0.45, 0]} material={mats.fabric} radius={0.035} />
      <Box size={[0.44, 0.56, 0.07]} position={[0, 0.8, 0.22]} material={mats.fabric} radius={0.035} />
      {[-0.255, 0.255].map((x) => (
        <group key={x}>
          <Box size={[0.035, 0.18, 0.04]} position={[x, 0.57, 0.05]} material={mats.chairBase} radius={0.01} />
          <Box size={[0.06, 0.03, 0.26]} position={[x, 0.67, 0.0]} material={mats.chairFrame} radius={0.012} />
        </group>
      ))}
    </group>
  );
}

/**
 * 007 US3: meeting table (cream top on teal legs, like the desks) with an office chair at every seat of its
 * catalog entry, each turned to face the table. Drawn in the item's own frame, centred on the footprint.
 */
export function MeetingTable({ type }: { type: 'meeting_table_4' | 'meeting_table_8' }) {
  const { w, d } = CATALOG[type].footprint;
  const tw = w * CELL - 0.05;
  const td = d * CELL - 0.05;
  const seats = useMemo(() => seatPoints({ id: '', type, pos: { x: 0, z: 0 }, rotation: 0 }).map((s) => s.local), [type]);
  const legs = [
    [-tw / 2 + 0.12, -td / 2 + 0.12],
    [tw / 2 - 0.12, -td / 2 + 0.12],
    [-tw / 2 + 0.12, td / 2 - 0.12],
    [tw / 2 - 0.12, td / 2 - 0.12],
  ];
  return (
    <group>
      <Box size={[tw, 0.05, td]} position={[0, 0.74, 0]} material={mats.deskTop} radius={0.025} />
      {legs.map(([x, z], i) => (
        <Cyl key={i} r={0.04} h={0.72} position={[x!, 0.36, z!]} material={mats.leg} seg={14} />
      ))}
      {seats.map((s, i) => (
        // The chair back is at its +z; turn it square to the side of the table it stands at, back outwards.
        <group key={i} position={[s.x, 0, s.z]} rotation-y={Math.abs(s.z) > td / 2 ? (s.z > 0 ? 0 : Math.PI) : s.x > 0 ? Math.PI / 2 : -Math.PI / 2}>
          <Chair />
        </group>
      ))}
    </group>
  );
}

/** 007 US5: outer frame size and picture size (metres) of each frame type. */
const FRAME_SIZE = {
  painting: { w: 1.0, h: 0.7, pw: 0.9, ph: 0.6 },
  photo_frame: { w: 0.4, h: 0.5, pw: 0.32, ph: 0.42 },
} as const;
const FRAME_Y = 1.5;

/**
 * 007 US5: a painting or photo frame hanging on its wall, centred on its group and facing +z (the group is
 * turned to the side it hangs on). Shows the user's uploaded picture, cropped to fill, or a default picture
 * when there is none or it cannot be loaded. The frame's back is visible through glass from the other side.
 */
export function PictureFrame({ type, picture, low = false, height = FRAME_Y }: { type: 'painting' | 'photo_frame'; picture?: string; low?: boolean; height?: number }) {
  const s = FRAME_SIZE[type];
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!picture) {
      setTex(null);
      return;
    }
    let alive = true;
    let loaded: THREE.Texture | null = null;
    loadPictureTexture(picture)
      .then((t) => {
        loaded = t;
        if (!alive) return t?.dispose();
        if (t) coverFit(t, s.pw / s.ph);
        setTex(t);
      })
      .catch(() => alive && setTex(null));
    return () => {
      alive = false;
      loaded?.dispose();
    };
  }, [picture, s.pw, s.ph]);
  const map = tex ?? defaultPictureTexture(type === 'painting' ? 'painting' : 'photo');
  return (
    // `low`: the solid wall behind it is cut down (overview camera), so the frame stands on the wall's top edge.
    <group position={[0, low ? CUTAWAY_WALL_H + s.h / 2 : height, 0.06]}>
      <Box size={[s.w, s.h, 0.035]} position={[0, 0, 0]} material={mats.frame} radius={0.008} />
      <mesh position={[0, 0, 0.019]}>
        <planeGeometry args={[s.pw, s.ph]} />
        <meshStandardMaterial map={map} roughness={0.6} />
      </mesh>
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

/** 004 US4 (FR-031): off = a dark panel (as before); on = a glowing board with the time and the team. */
export function WallScreenFrame({ on = false }: { on?: boolean }) {
  return (
    <group>
      <Box size={[1.4, 0.8, 0.05]} position={[0, 1.6, 0]} material={mats.monitor} radius={0.03} />
      {on && <ScreenBoard />}
    </group>
  );
}

function ScreenBoard() {
  const byId = useEmployees((s) => s.byId);
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 288;
    return c;
  }, []);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [canvas]);
  // Redraw the clock every 30 s.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const g = canvas.getContext('2d')!;
    const list = Object.values(byId);
    const count = (f: (s: string) => boolean) => list.filter((e) => f(e.visualState)).length;
    g.fillStyle = '#123a3a';
    g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#fff4e0';
    g.font = '700 84px "Baloo 2 Variable", sans-serif';
    g.textBaseline = 'top';
    g.fillText(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), 28, 18);
    g.font = '600 34px "Baloo 2 Variable", sans-serif';
    const rows: [string, number, string][] = [
      ['Working', count((s) => s === 'working' || s === 'thinking'), '#9ccfb4'],
      ['Waiting', count((s) => s === 'waiting_for_boss'), '#f2c94c'],
      ['Idle', count((s) => s === 'idle'), '#efe4cc'],
    ];
    rows.forEach(([label, n, color], i) => {
      g.fillStyle = color;
      g.fillText(`${label}: ${n}`, 32, 130 + i * 48);
    });
    tex.needsUpdate = true;
  }, [byId, tick, canvas, tex]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 1.6, 0.027]}>
      <planeGeometry args={[1.3, 0.72]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.85} roughness={0.3} />
    </mesh>
  );
}

/**
 * 004 US4 (FR-034): a sliding glass door in the door gap. Opens when someone is within 1.5 m (`isNear`),
 * closes again. Visual only: walking through is decided by the navigation grid.
 */
export function Door({ cutaway = true, isNear }: { cutaway?: boolean; isNear?: () => boolean }) {
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const open = useRef(0);
  const h = cutaway ? CUTAWAY_WALL_H : 2.2;
  useFrame((_, dt) => {
    const target = isNear?.() ? 1 : 0;
    open.current += (target - open.current) * Math.min(1, dt * 6);
    const off = 0.24 + open.current * 0.46;
    if (left.current) left.current.position.x = -off;
    if (right.current) right.current.position.x = off;
  });
  return (
    <group>
      <Box size={[0.95, 0.03, 0.5]} position={[0, 0.015, 0]} material={mats.mat} radius={0.01} />
      <mesh ref={left} position={[-0.24, h / 2, 0]} material={mats.glass}>
        <boxGeometry args={[0.47, h, 0.04]} />
      </mesh>
      <mesh ref={right} position={[0.24, h / 2, 0]} material={mats.glass}>
        <boxGeometry args={[0.47, h, 0.04]} />
      </mesh>
    </group>
  );
}

const WALL_H = 2.6;

/**
 * 007 US2: interior office door, 1 m wide, centred on its group; `vertical` runs along z. Thin frame
 * (posts + header) and a glass leaf on its hinge. 008: the leaf swings with the door's openness (DoorBook);
 * the doorway stays passable in the navigation grid, and employees open a closed door before walking through.
 */
export function OfficeDoor({ vertical, openness }: { vertical: boolean; openness?: () => number }) {
  const H = 2.2;
  // 008: the leaf swings from closed (in the wall line) to 90° open on its hinge, read every frame.
  const leaf = useRef<THREE.Group>(null);
  useFrame(() => {
    if (leaf.current) leaf.current.rotation.y = -(openness?.() ?? 1) * (Math.PI / 2);
  });
  return (
    <group rotation-y={vertical ? Math.PI / 2 : 0}>
      <Box size={[0.06, WALL_H, 0.1]} position={[-0.47, WALL_H / 2, 0]} material={mats.frame} radius={0.02} />
      <Box size={[0.06, WALL_H, 0.1]} position={[0.47, WALL_H / 2, 0]} material={mats.frame} radius={0.02} />
      <Box size={[1.0, WALL_H - H, 0.1]} position={[0, (WALL_H + H) / 2, 0]} material={mats.frame} radius={0.02} />
      <group ref={leaf} position={[-0.44, 0, 0]} rotation-y={-Math.PI / 2}>
        <mesh position={[0.43, H / 2, 0]} material={mats.glass}>
          <boxGeometry args={[0.86, H - 0.02, 0.04]} />
        </mesh>
        <Box size={[0.03, 0.2, 0.05]} position={[0.8, 1.0, 0.03]} material={mats.frame} radius={0.01} />
      </group>
    </group>
  );
}

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
  // 007: a frame's rotation is the direction it faces (0 south, 90 east, …), so its model's +z turns that way.
  const a = (item.rotation * Math.PI) / 180;
  return {
    position: floorToWorld(floor, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2),
    rotationY: edge ? 0 : isWallMounted(item.type) ? a : -a,
  };
}

export const furnitureFor: Partial<Record<ItemType, React.ComponentType>> = {
  chair: Chair,
  plant: Plant,
  water_cooler: WaterCooler,
  sofa: Sofa,
  wall_screen: WallScreenFrame,
  door: Door,
};
