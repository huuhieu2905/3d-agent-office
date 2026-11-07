import { useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Employee, OfficeLayout, PlacedItem } from '@shared/domain';
import { footprintCells, rotatedSize } from '@shared/catalog';
import { insideFloor, validateLayout } from '@shared/layout-validation';
import { useBuild } from '../state/build';
import type { OfficeGrid } from './grid/grid';
import { itemTransform } from './furniture/Furniture';
import { api } from '../api/client';

// T102 + T103: snapping preview (green = valid, red = invalid), place on click, drag to move items,
// drop an employee on a desk to seat them there.

function ghostValid(layout: OfficeLayout, ghost: PlacedItem): boolean {
  if (!insideFloor(layout, ghost)) return false;
  const v = validateLayout({ ...layout, items: [...layout.items, ghost] });
  return !v.invalidItems.includes(ghost.id);
}

export function BuildGizmo({ layout, grid, employees }: { layout: OfficeLayout; grid: OfficeGrid; employees: Employee[] }) {
  const { palette, rotation, place, selectedId, move, draggingEmployee, setDraggingEmployee } = useBuild();
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const dragItem = useRef<string | null>(null);
  const w = layout.floor.widthCells * layout.floor.cellSize;
  const d = layout.floor.depthCells * layout.floor.cellSize;

  const ghost: PlacedItem | null = useMemo(() => {
    if (!hover || !palette) return null;
    return { id: '__ghost__', type: palette, cell: hover, rotation };
  }, [hover, palette, rotation]);
  const valid = ghost ? ghostValid(layout, ghost) : false;

  const cellAt = (e: ThreeEvent<PointerEvent>) => {
    const c = grid.toCell(e.point.x, e.point.z);
    // Centre multi-cell footprints under the cursor.
    if (palette) {
      const { w: fw, d: fd } = rotatedSize(palette, rotation);
      return { x: c.x - Math.floor((fw - 1) / 2), z: c.z - Math.floor((fd - 1) / 2) };
    }
    return c;
  };

  const deskAtCell = (c: { x: number; z: number }) =>
    layout.items.find((i) => i.type === 'desk' && footprintCells(i).some((k) => k.x === c.x && k.z === c.z));

  return (
    <group>
      {/* Pointer-catching floor (slightly above the real floor). */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.01, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          const c = cellAt(e);
          setHover(c);
          if (dragItem.current) {
            const it = layout.items.find((i) => i.id === dragItem.current);
            if (it && (it.cell.x !== c.x || it.cell.z !== c.z)) move(it.id, c);
          }
        }}
        onPointerOut={() => setHover(null)}
        onPointerDown={(e) => {
          if (!palette && selectedId) {
            const c = grid.toCell(e.point.x, e.point.z);
            const it = layout.items.find((i) => i.id === selectedId);
            if (it && footprintCells(it).some((k) => k.x === c.x && k.z === c.z)) {
              e.stopPropagation();
              dragItem.current = selectedId;
            }
          }
        }}
        onPointerUp={(e) => {
          dragItem.current = null;
          if (draggingEmployee) {
            e.stopPropagation();
            const desk = deskAtCell(grid.toCell(e.point.x, e.point.z));
            const id = draggingEmployee;
            setDraggingEmployee(null);
            if (desk) void api(`/api/employees/${id}/profile`, { method: 'PUT', json: { deskId: desk.id } }).catch(() => undefined);
          }
        }}
        onClick={(e) => {
          if (!ghost) return;
          e.stopPropagation();
          if (valid) place({ type: ghost.type, cell: ghost.cell, rotation: ghost.rotation });
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Grid lines */}
      <gridHelper args={[Math.max(w, d), Math.max(layout.floor.widthCells, layout.floor.depthCells), '#7c8db5', '#b8c2d6']} position={[0, 0.005, 0]} />
      {ghost && <GhostBox item={ghost} grid={grid} valid={valid} />}
      {selectedId && (() => {
        const it = layout.items.find((i) => i.id === selectedId);
        return it ? <GhostBox item={it} grid={grid} valid outline /> : null;
      })()}
      {draggingEmployee && hover && (() => {
        const desk = deskAtCell(hover);
        return desk ? <GhostBox item={desk} grid={grid} valid outline /> : null;
      })()}
      {employees.length === 0 ? null : null}
    </group>
  );
}

function GhostBox({ item, grid, valid, outline = false }: { item: PlacedItem; grid: OfficeGrid; valid: boolean; outline?: boolean }) {
  const { w, d } = rotatedSize(item.type, item.rotation);
  const t = itemTransform({ ...item, rotation: 0, type: item.type }, grid);
  const s = grid.cellSize;
  const [x0, , z0] = grid.toWorld(item.cell);
  const pos: [number, number, number] =
    item.type === 'wall' || item.type === 'glass_wall' ? [t.position[0], 0.6, t.position[2]] : [x0 + ((w - 1) * s) / 2, 0.6, z0 + ((d - 1) * s) / 2];
  return (
    <mesh position={pos}>
      <boxGeometry args={[w * s * 0.98, 1.2, d * s * 0.98]} />
      <meshBasicMaterial color={valid ? '#2ec4b6' : '#d64545'} transparent opacity={outline ? 0.18 : 0.35} depthWrite={false} wireframe={outline} />
    </mesh>
  );
}
