import { useCallback, useEffect, useRef, useState } from 'react';
import type { Employee } from '@shared/domain';

// Keeps employees on stage while they walk in (`entering`) and out (`leaving`) of the office.
// A removed employee stays rendered until its brain reports it reached the door.

export interface StageEntry {
  employee: Employee;
  leaving: boolean;
  /** True for employees that appeared after the first snapshot (they walk in from the door). */
  enter: boolean;
}

export function useEmployeeStage(visible: Employee[], ready: boolean) {
  const [stage, setStage] = useState<Map<string, StageEntry>>(new Map());
  const firstSnapshot = useRef(true);

  useEffect(() => {
    if (!ready) return;
    setStage((prev) => {
      const next = new Map<string, StageEntry>();
      const ids = new Set(visible.map((e) => e.conversationId));
      for (const e of visible) {
        const old = prev.get(e.conversationId);
        next.set(e.conversationId, { employee: e, leaving: false, enter: old ? old.enter : !firstSnapshot.current });
      }
      for (const [id, old] of prev) if (!ids.has(id)) next.set(id, { ...old, leaving: true });
      firstSnapshot.current = false;
      return next;
    });
  }, [visible, ready]);

  const onLeft = useCallback((id: string) => {
    setStage((prev) => {
      if (!prev.get(id)?.leaving) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { entries: [...stage.values()], onLeft };
}
