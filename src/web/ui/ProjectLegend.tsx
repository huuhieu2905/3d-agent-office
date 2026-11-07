import { useEffect, useState } from 'react';
import type { Project } from '@shared/domain';
import { api } from '../api/client';
import { useEmployees } from '../state/employees';
import { useUi } from '../state/ui';
import { useConnection } from '../state/connection';
import { useShallow } from 'zustand/react/shallow';
import { PROJECTS_CHANGED } from './projects/ProjectDialog';

// T056 / FR-013: colour legend per project; click to highlight that project's employees.

export function ProjectLegend() {
  const [projects, setProjects] = useState<Project[]>([]);
  const connected = useConnection((s) => s.app.kind === 'connected');
  const usedIds = useEmployees(useShallow((s) => [...new Set(Object.values(s.byId).map((e) => e.projectId ?? ''))].sort()));
  const used = new Set(usedIds);
  const highlight = useUi((s) => s.highlightProjectId);
  const setHighlight = useUi((s) => s.setHighlightProject);

  useEffect(() => {
    if (!connected) return;
    const load = () => api<Project[]>('/api/projects').then(setProjects).catch(() => undefined);
    void load();
    window.addEventListener(PROJECTS_CHANGED, load);
    return () => window.removeEventListener(PROJECTS_CHANGED, load);
  }, [connected]);

  const shown = projects.filter((p) => used.has(p.id));
  if (shown.length === 0) return null;
  return (
    <div className="legend panel" aria-label="Chú giải dự án">
      {shown.map((p) => (
        <button
          key={p.id}
          className={`legend-item ${highlight === p.id ? 'active' : ''}`}
          onClick={() => setHighlight(highlight === p.id ? null : p.id)}
          title="Bấm để làm nổi bật nhân viên của dự án này"
        >
          <span className="tag-dot" style={{ background: p.color }} />
          {p.name}
        </button>
      ))}
    </div>
  );
}
