import { useMemo } from 'react';
import type { Employee, OfficeLayout } from '@shared/domain';
import { OfficeGrid } from './grid/grid';
import { Desk, EdgePanel, furnitureFor, itemTransform, palette } from './furniture/Furniture';

// Floor, walls and furniture from the OfficeLayout (FR-050/FR-054). Only the office casts shadows (R4).

export function Office({
  layout,
  grid,
  employeesByDesk,
  theme,
  cutaway = true,
  children,
}: {
  layout: OfficeLayout;
  grid: OfficeGrid;
  employeesByDesk: Map<string, Employee>;
  theme: 'light' | 'dark';
  cutaway?: boolean;
  children?: React.ReactNode;
}) {
  const w = layout.floor.widthCells * layout.floor.cellSize;
  const d = layout.floor.depthCells * layout.floor.cellSize;
  const items = useMemo(() => layout.items, [layout]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={theme === 'dark' ? palette.floorDark : palette.floor} roughness={0.9} />
      </mesh>
      {items.map((item) => {
        const t = itemTransform(item, grid);
        let content: React.ReactNode = null;
        if (item.type === 'wall' || item.type === 'glass_wall') {
          content = <EdgePanel type={item.type} rotation={item.rotation} cellSize={grid.cellSize} cutaway={cutaway} />;
        } else if (item.type === 'desk') {
          const e = employeesByDesk.get(item.id);
          content = <Desk screenOn={e?.visualState === 'working' || e?.visualState === 'thinking'} />;
        } else {
          const C = furnitureFor[item.type];
          content = C ? <C /> : null;
        }
        return (
          <group key={item.id} position={t.position} rotation-y={t.rotationY} userData={{ itemId: item.id }}>
            {content}
          </group>
        );
      })}
      {children}
    </group>
  );
}
