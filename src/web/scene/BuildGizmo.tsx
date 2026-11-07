import { useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Employee, OfficeLayout, PlacedItem } from '@shared/domain';
import { footprintRect, isEdge, sizeM, snap } from '@shared/catalog';
import { insideFloor, validateLayout } from '@shared/layout-validation';
import { useBuild } from '../state/build';
import { floorToWorld } from './furniture/Furniture';
import { api } from '../api/client';

// T102 + T103 (001), ported to layout v2 in 002 Phase 2: snapping preview (green = valid, red = invalid),
// place on click, drag to move items, drop an employee on a desk to seat them there.
// Placement still snaps to 0.5 m here; US2 replaces this with the shared DragController (0.05 m).

function ghostValid(layout: OfficeLayout, ghost: PlacedItem): boolean {
  if (!insideFloor(layout, ghost)) return false;
  const v = validateLayout({ ...layout, items: [...layout.items, ghost] });
  return !v.invalidItems.includes(ghost.id);
}

export function BuildGizmo({ layout }: { layout: OfficeLayout; employees: Employee[] }) {
  const { palette, rotation, place, selectedId, move, draggingEmployee, setDraggingEmployee } = useBuild();
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const dragItem = useRef<string | null>(null);
  const { width: w, depth: d } = layout.floor;

  // Pointer (world) → floor-space metres.
  const toFloor = (e: ThreeEvent<PointerEvent>) => ({ x: e.point.x + w / 2, z: e.point.z + d / 2 });
  const posAt = (e: ThreeEvent<PointerEvent>, type: PlacedItem['type'], rot: PlacedItem['rotation']) => {
    const p = toFloor(e);
    if (isEdge(type)) return { x: snap(p.x - 0.25, 0.5), z: snap(p.z - 0.25, 0.5) };
    const s = sizeM(type, rot);
    return { x: snap(p.x - s.w / 2, 0.5), z: snap(p.z - s.d / 2, 0.5) };
  };

  const ghost: PlacedItem | null = useMemo(() => {
    if (!hover || !palette) return null;
    return { id: '__ghost__', type: palette, pos: hover, rotation };
  }, [hover, palette, rotation]);
  const valid = ghost ? ghostValid(layout, ghost) : false;

  const deskAt = (p: { x: number; z: number }) =>
    layout.items.find((i) => {
      if (i.type !== 'desk') return false;
      const r = footprintRect(i);
      return p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1;
    });
  const [hoverPoint, setHoverPoint] = useState<{ x: number; z: number } | null>(null);

  return (
    <group>
      {/* Pointer-catching floor (slightly above the real floor). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.01, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          setHoverPoint(toFloor(e));
          if (palette) setHover(posAt(e, palette, rotation));
          if (dragItem.current) {
            const it = layout.items.find((i) => i.id === dragItem.current);
            if (it) {
              const pos = posAt(e, it.type, it.rotation);
              if (it.pos.x !== pos.x || it.pos.z !== pos.z) move(it.id, pos);
            }
          }
        }}
        onPointerOut={() => {
          setHover(null);
          setHoverPoint(null);
        }}
        onPointerDown={(e) => {
          if (!palette && selectedId) {
            const p = toFloor(e);
            const it = layout.items.find((i) => i.id === selectedId);
            const r = it && footprintRect(it);
            if (r && p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) {
              e.stopPropagation();
              dragItem.current = selectedId;
            }
          }
        }}
        onPointerUp={(e) => {
          dragItem.current = null;
          if (draggingEmployee) {
            e.stopPropagation();
            const desk = deskAt(toFloor(e));
            const id = draggingEmployee;
            setDraggingEmployee(null);
            if (desk) void api(`/api/employees/${id}/profile`, { method: 'PUT', json: { deskId: desk.id } }).catch(() => undefined);
          }
        }}
        onClick={(e) => {
          if (!ghost) return;
          e.stopPropagation();
          if (valid) place({ type: ghost.type, pos: ghost.pos, rotation: ghost.rotation });
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.max(w, d) * 2, '#7c8db5', '#b8c2d6']} position={[0, 0.005, 0]} />
      {ghost && <GhostBox item={ghost} layout={layout} valid={valid} />}
      {selectedId &&
        (() => {
          const it = layout.items.find((i) => i.id === selectedId);
          return it ? <GhostBox item={it} layout={layout} valid outline /> : null;
        })()}
      {draggingEmployee &&
        hoverPoint &&
        (() => {
          const desk = deskAt(hoverPoint);
          return desk ? <GhostBox item={desk} layout={layout} valid outline /> : null;
        })()}
    </group>
  );
}

function GhostBox({ item, layout, valid, outline = false }: { item: PlacedItem; layout: OfficeLayout; valid: boolean; outline?: boolean }) {
  const r = footprintRect(item);
  const edge = isEdge(item.type);
  const w = Math.max(r.x1 - r.x0, edge ? 0.1 : 0);
  const d = Math.max(r.z1 - r.z0, edge ? 0.1 : 0);
  const [x, , z] = floorToWorld(layout.floor, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
  return (
    <mesh position={[x, 0.6, z]}>
      <boxGeometry args={[w * 0.98, 1.2, d * 0.98]} />
      <meshBasicMaterial color={valid ? '#2ec4b6' : '#d64545'} transparent opacity={outline ? 0.18 : 0.35} depthWrite={false} wireframe={outline} />
    </mesh>
  );
}
