import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { jiggleOf } from './furniture/PropJiggle';
import type { Employee, OfficeLayout, PlacedItem } from '@shared/domain';
import { DOOR_WIDTH } from '@shared/domain';
import { isEdge } from '@shared/catalog';
import { Desk, Door, EdgePanel, floorToWorld, furnitureFor, itemTransform, palette } from './furniture/Furniture';
import { useUi } from '../state/ui';

// Floor, shell and furniture from the OfficeLayout v2 (FR-050/FR-054, 002 R2-03/R2-05). The shell
// (perimeter walls, the glass façade facing the park and the main door) is generated from the floor
// size, so resizing the office never edits individual wall items. Only the office casts shadows (R4).

interface ShellPanel {
  key: string;
  type: 'wall' | 'glass_wall';
  vertical: boolean;
  /** Floor-space centre and length (metres). */
  x: number;
  z: number;
  length: number;
}

export function shellPanels(layout: OfficeLayout): ShellPanel[] {
  const { width: W, depth: D } = layout.floor;
  const { side, offset } = layout.shell.door;
  const out: ShellPanel[] = [];
  // A side split around the door gap when the door is on it.
  const run = (key: string, type: ShellPanel['type'], vertical: boolean, fixed: number, len: number, gap: boolean) => {
    const parts: [number, number][] = gap ? [[0, offset], [offset + DOOR_WIDTH, len]] : [[0, len]];
    parts.forEach(([a, b], i) => {
      if (b - a < 0.01) return;
      const mid = (a + b) / 2;
      out.push({ key: `${key}-${i}`, type, vertical, length: b - a, x: vertical ? fixed : mid, z: vertical ? mid : fixed });
    });
  };
  run('north', 'glass_wall', false, 0, W, false);
  run('south', 'wall', false, D, W, side === 'south');
  run('west', 'wall', true, 0, D, side === 'west');
  run('east', 'wall', true, W, D, side === 'east');
  return out;
}

export function doorTransform(layout: OfficeLayout): { position: [number, number, number]; rotationY: number } {
  const { width: W, depth: D } = layout.floor;
  const { side, offset } = layout.shell.door;
  const mid = offset + DOOR_WIDTH / 2;
  if (side === 'south') return { position: floorToWorld(layout.floor, mid, D - 0.25), rotationY: 0 };
  if (side === 'east') return { position: floorToWorld(layout.floor, W - 0.25, mid), rotationY: Math.PI / 2 };
  return { position: floorToWorld(layout.floor, 0.25, mid), rotationY: Math.PI / 2 };
}

/** Renders the damped wobble of a bumped light prop (T046); never touches the saved position. */
function Jiggle({ id, children }: { id: string; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const j = jiggleOf(id);
    const el = g.current;
    if (!el) return;
    if (j) {
      el.position.set(j.dx, 0, j.dz);
      el.rotation.z = j.tilt;
    } else if (el.rotation.z !== 0 || el.position.x !== 0) {
      el.position.set(0, 0, 0);
      el.rotation.z = 0;
    }
  });
  return <group ref={g}>{children}</group>;
}

export function Office({
  layout,
  employeesByDesk,
  theme,
  cutaway = true,
  onItemPress,
  children,
}: {
  layout: OfficeLayout;
  employeesByDesk: Map<string, Employee>;
  theme: 'light' | 'dark';
  cutaway?: boolean;
  /** Arrange mode: pressing an item selects it and may start a drag (002 US2). */
  onItemPress?: (item: PlacedItem, e: PointerEvent) => void;
  children?: React.ReactNode;
}) {
  const { width: w, depth: d } = layout.floor;
  const items = useMemo(() => layout.items, [layout]);
  const shell = useMemo(() => shellPanels(layout), [layout]);
  const door = doorTransform(layout);
  const setHireDesk = useUi((s) => s.setHireDesk);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={theme === 'dark' ? palette.floorDark : palette.floor} roughness={0.9} />
      </mesh>
      {shell.map((p) => (
        <group key={p.key} position={floorToWorld(layout.floor, p.x, p.z)}>
          <EdgePanel type={p.type} vertical={p.vertical} length={p.length} cutaway={cutaway} />
        </group>
      ))}
      <group position={door.position} rotation-y={door.rotationY}>
        <Door />
      </group>
      {items.map((item) => {
        const t = itemTransform(item, layout.floor);
        let content: React.ReactNode;
        if (isEdge(item.type)) {
          content = <EdgePanel type={item.type as 'wall' | 'glass_wall'} vertical={item.rotation === 90 || item.rotation === 270} length={0.5} cutaway={cutaway} />;
        } else if (item.type === 'desk') {
          const e = employeesByDesk.get(item.id);
          content = <Desk screenOn={e?.visualState === 'working' || e?.visualState === 'thinking'} />;
        } else {
          const C = furnitureFor[item.type];
          content = C ? item.type === 'chair' || item.type === 'plant' ? <Jiggle id={item.id}><C /></Jiggle> : <C /> : null;
        }
        return (
          <group
            key={item.id}
            position={t.position}
            rotation-y={t.rotationY}
            userData={{ itemId: item.id }}
            onPointerDown={
              onItemPress
                ? (e) => {
                    e.stopPropagation();
                    onItemPress(item, e.nativeEvent);
                  }
                : undefined
            }
            onClick={
              onItemPress
                ? (e) => e.stopPropagation()
                : item.type === 'desk' && !employeesByDesk.has(item.id)
                ? (e) => {
                    e.stopPropagation();
                    setHireDesk(item.id); // empty desk → hire a new employee here (FR-026)
                  }
                : undefined
            }
          >
            {content}
          </group>
        );
      })}
      {children}
    </group>
  );
}
