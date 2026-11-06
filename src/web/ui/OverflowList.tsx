import { useState } from 'react';
import { selectHidden, useEmployees } from '../state/employees';
import { useUi } from '../state/ui';
import { useShallow } from 'zustand/react/shallow';

// T055: employees beyond the 20 shown in the office (FR-004), openable from a side list.

export function OverflowList() {
  const hidden = useEmployees(useShallow(selectHidden));
  const overflow = useEmployees((s) => s.overflow);
  const open = useUi((s) => s.openConversation);
  const [expanded, setExpanded] = useState(false);
  if (overflow === 0 && hidden.length === 0) return null;
  const sorted = [...hidden].sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
  return (
    <div className="overflow panel">
      <button className="link" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        +{overflow} nhân viên khác {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <ul>
          {sorted.map((e) => (
            <li key={e.conversationId}>
              <button className="row" onClick={() => open(e.conversationId)}>
                <span className="tag-dot" style={{ background: e.projectColor }} />
                <span className="row-name">{e.name}</span>
                <span className={`state state-${e.visualState}`}>{e.visualState}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
