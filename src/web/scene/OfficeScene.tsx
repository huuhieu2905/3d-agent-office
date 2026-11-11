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
import { BuildGizmo } from './BuildGizmo';
import { useBuild } from '../state/build';
import { LAYOUT_CHANGED } from '../ui/build/BuildMode';
import { CITY_SEED, Surroundings, useCityWeather } from './Surroundings';
import { SiteGrid } from '@shared/site-nav';
import { parkFrame, parkShops, visibleTrees } from './park/park-layout';
import { DETAIL, PARK_RADIUS } from './park/detail';
import { SpotBook } from './break-spots';
import { useSettings } from '../state/settings';
import { useWeather } from '../state/weather';
import { LIGHT_FACTOR } from './weather/Weather';
import { FirstPersonCamera } from './cameras/FirstPerson';
import { TestHooks, testHooksEnabled } from './interaction/TestHooks';
import { Crowd } from './crowd/crowd';
import { DragLayer, beginDrag } from './interaction/DragLayer';

export function OfficeScene({
  theme,
  layoutOverride,
  benchMode = false,
}: {
  theme: 'light' | 'dark';
  layoutOverride?: OfficeLayout;
  benchMode?: boolean;
}) {
  const [saved, setSaved] = useState<OfficeLayout | null>(layoutOverride ?? null);
  const serverOnline = useConnection((s) => s.serverOnline);
  useEffect(() => {
    if (layoutOverride || !serverOnline) return;
    const load = () => api<OfficeLayout>('/api/layout').then(setSaved).catch(() => undefined);
    void load();
    window.addEventListener(LAYOUT_CHANGED, load);
    return () => window.removeEventListener(LAYOUT_CHANGED, load);
  }, [serverOnline, layoutOverride]);
  const build = useBuild();
  const { city, detailLevel } = useSettings((s) => s.settings);
  useCityWeather(city, !benchMode && serverOnline);
  const condition = useWeather((s) => (s.weather?.city === city ? s.weather.condition : 'clear'));
  const layout = build.active && build.draft ? build.draft : saved;

  const grid = useMemo(() => (layout ? new OfficeGrid(layout) : null), [layout]);
  // Stable size object so the memoised background only re-renders when the office is resized.
  const floorSize = useMemo(() => ({ width: layout?.floor.width ?? 16, depth: layout?.floor.depth ?? 12 }), [layout?.floor.width, layout?.floor.depth]);
  // 004 US3 (R4-03): the park around the office — its shops and the trees actually drawn — and one grid
  // for office + park, so employees (and the first-person user) can walk out of the door.
  const frame = useMemo(() => parkFrame(floorSize), [floorSize]);
  const shops = useMemo(() => parkShops(frame), [frame]);
  // Round obstacles: shop tables and the trees drawn at the current detail level / city.
  const circles = useMemo(
    () => [...shops.flatMap((s) => s.tables), ...visibleTrees(frame, CITY_SEED[city], DETAIL[detailLevel].trees).map((t) => ({ x: t.x, z: t.z, r: 0.35 }))],
    [frame, shops, city, detailLevel],
  );
  const circlesRef = useRef(circles);
  circlesRef.current = circles;
  // The grid (and so every employee brain) is rebuilt only when the office itself changes (T062).
  const site = useMemo(
    () => (grid ? new SiteGrid(grid, { radius: PARK_RADIUS - 1, boxes: shops.map((s) => s.box), circles: circlesRef.current }) : null),
    [grid, shops],
  );
  useEffect(() => site?.setCircles(circles), [site, circles]);
  // One booking table for sofa seats, shop stools and outing slots, kept across layout edits.
  const spots = useMemo(() => new SpotBook(), []);
  // One crowd per office grid (US3 T044): employees never overlap and give way to each other.
  const crowd = useMemo(() => (site ? new Crowd(site) : null), [site]);
  useEffect(() => {
    if (benchMode && crowd) window.__crowd = crowd; // bench: count overlaps (T047)
  }, [benchMode, crowd]);
  const disconnected = useConnection(isDisconnected);
  const served = useEmployees(useShallow(selectVisible));
  // Arrange mode: employees moved in the draft walk to their draft desk before anything is saved (T036).
  const { seating, meetingSeating } = build;
  const visible = useMemo(() => {
    if (!build.active || (Object.keys(seating).length === 0 && Object.keys(meetingSeating).length === 0)) return served;
    return served.map((e) => {
      const id = e.conversationId;
      if (!(id in seating) && !(id in meetingSeating)) return e;
      return { ...e, deskId: id in seating ? (seating[id] ?? null) : e.deskId, meetingSeatId: id in meetingSeating ? (meetingSeating[id] ?? null) : e.meetingSeatId };
    });
  }, [served, build.active, seating, meetingSeating]);
  const currentDesks = useMemo(() => Object.fromEntries(served.map((e) => [e.conversationId, e.deskId])), [served]);
  const currentSeats = useMemo(() => Object.fromEntries(served.map((e) => [e.conversationId, e.meetingSeatId])), [served]);
  const highlight = useUi((s) => s.highlightProjectId);
  const cameraMode = useUi((s) => s.camera);
  const positions = useRef(new Map<string, THREE.Vector3>()).current;

  // Subagents without a desk fold into their parent's badge (T057).
  const onStage = useMemo(() => visible.filter((e) => !(e.isSubagent && !e.deskId && !e.meetingSeatId)), [visible]);
  const folded = useMemo(() => subagentOverflow(visible), [visible]);
  const { entries, onLeft } = useEmployeeStage(onStage, !!grid);
  useEffect(() => spots.setPopulation(onStage.length), [spots, onStage.length]);

  const byDesk = useMemo(() => {
    const m = new Map<string, EmployeeT>();
    for (const e of visible) if (e.deskId) m.set(e.deskId, e);
    return m;
  }, [visible]);

  if (!layout || !grid || !site) return <OfficeMood disconnected theme={theme} />;
  const size: [number, number] = [layout.floor.width, layout.floor.depth];
  let lobbySlot = 0;

  return (
    <>
      <OfficeMood disconnected={disconnected} theme={theme} weatherFactor={LIGHT_FACTOR[condition]} floor={layout.floor} />
      <Surroundings city={city} detail={detailLevel} theme={theme} floor={floorSize} />
      {!benchMode && (cameraMode === 'first_person' && !build.active ? <FirstPersonCamera site={site} positions={positions} layout={layout} crowd={crowd ?? undefined} spots={spots} /> : <OverviewCamera size={size} />)}
      <Office
        layout={layout}
        positions={positions}
        employeesByDesk={byDesk}
        theme={theme}
        cutaway={cameraMode !== 'first_person' || build.active}
        onItemPress={
          build.active
            ? (item, e) => {
                // 006 FR-010/011: right-click deletes only the item already selected; never selects or drags.
                // A right press during a left drag fires no pointerdown (chorded buttons arrive as pointermove).
                if (e.button === 2) {
                  if (item.id === build.selectedId) build.removeSelected();
                  return;
                }
                build.select(item.id);
                beginDrag('item', item.id, item.pos, e);
              }
            : undefined
        }
      >
        {entries.map(({ employee, leaving, enter }) => (
          <Employee
            key={employee.conversationId}
            employee={folded.has(employee.conversationId) ? { ...employee, name: `${employee.name} (+${folded.get(employee.conversationId)})` } : employee}
            grid={site}
            spots={spots}
            shops={shops}
            frame={frame}
            weather={condition}
            enter={enter}
            leaving={leaving}
            lobbySlot={employee.deskId || employee.meetingSeatId ? 0 : lobbySlot++}
            dimmed={!!highlight && employee.projectId !== highlight}
            onLeft={onLeft}
            positions={positions}
            crowd={crowd ?? undefined}
            layout={layout}
          />
        ))}
        <SubagentLinks employees={visible} positions={positions} />
        {!benchMode && !build.active && <QuotaScreen layout={layout} />}
        {build.active && <BuildGizmo layout={layout} />}
        {build.active && <DragLayer layout={layout} currentDesks={currentDesks} currentSeats={currentSeats} />}
        {testHooksEnabled() && <TestHooks layout={layout} />}
      </Office>
    </>
  );
}
