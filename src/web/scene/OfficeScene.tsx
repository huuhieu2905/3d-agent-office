import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import type { Employee as EmployeeT, OfficeLayout } from '@shared/domain';
import { api } from '../api/client';
import { isDisconnected, useConnection } from '../state/connection';
import { selectVisible, useEmployees } from '../state/employees';
import { useUi } from '../state/ui';
import { Employee } from './Employee';
import { useEmployeeStage } from './employee-lifecycle';
import { OfficeGrid } from './grid/grid';
import { Office } from './Office';
import { OfficeMood } from './OfficeMood';
import { OverviewCamera } from './cameras/Overview';
import { SubagentLinks, subagentOverflow } from './SubagentLinks';
import { QuotaScreen } from '../ui/quota/QuotaScreen';

export function OfficeScene({
  theme,
  layoutOverride,
  benchMode = false,
}: {
  theme: 'light' | 'dark';
  layoutOverride?: OfficeLayout;
  benchMode?: boolean;
}) {
  const [layout, setLayout] = useState<OfficeLayout | null>(layoutOverride ?? null);
  const serverOnline = useConnection((s) => s.serverOnline);
  useEffect(() => {
    if (layoutOverride || !serverOnline) return;
    api<OfficeLayout>('/api/layout').then(setLayout).catch(() => undefined);
  }, [serverOnline, layoutOverride]);

  const grid = useMemo(() => (layout ? new OfficeGrid(layout) : null), [layout]);
  const disconnected = useConnection(isDisconnected);
  const visible = useEmployees(useShallow(selectVisible));
  const highlight = useUi((s) => s.highlightProjectId);
  const positions = useRef(new Map<string, THREE.Vector3>()).current;

  // Subagents without a desk fold into their parent's badge (T057).
  const onStage = useMemo(() => visible.filter((e) => !(e.isSubagent && !e.deskId)), [visible]);
  const folded = useMemo(() => subagentOverflow(visible), [visible]);
  const { entries, onLeft } = useEmployeeStage(onStage, !!grid);

  const byDesk = useMemo(() => {
    const m = new Map<string, EmployeeT>();
    for (const e of visible) if (e.deskId) m.set(e.deskId, e);
    return m;
  }, [visible]);

  if (!layout || !grid) return <OfficeMood disconnected theme={theme} />;
  const size: [number, number] = [layout.floor.widthCells * layout.floor.cellSize, layout.floor.depthCells * layout.floor.cellSize];
  let lobbySlot = 0;

  return (
    <>
      <OfficeMood disconnected={disconnected} theme={theme} />
      {!benchMode && <OverviewCamera size={size} />}
      <Office layout={layout} grid={grid} employeesByDesk={byDesk} theme={theme}>
        {entries.map(({ employee, leaving, enter }) => (
          <Employee
            key={employee.conversationId}
            employee={folded.has(employee.conversationId) ? { ...employee, name: `${employee.name} (+${folded.get(employee.conversationId)})` } : employee}
            grid={grid}
            enter={enter}
            leaving={leaving}
            lobbySlot={employee.deskId ? 0 : lobbySlot++}
            dimmed={!!highlight && employee.projectId !== highlight}
            onLeft={onLeft}
            positions={positions}
          />
        ))}
        <SubagentLinks employees={visible} positions={positions} />
        {!benchMode && <QuotaScreen layout={layout} grid={grid} />}
      </Office>
    </>
  );
}
