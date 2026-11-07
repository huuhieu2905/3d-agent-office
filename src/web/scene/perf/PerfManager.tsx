import { PerformanceMonitor } from '@react-three/drei';
import { useRef } from 'react';
import type { DetailLevel } from '@shared/domain';
import { useSettings } from '../../state/settings';
import { useConnection } from '../../state/connection';

// T114 / R4: if FPS stays below 60 for ~3 s, lower the SURROUNDINGS detail one step (never the office) and
// tell the user. Rendering pauses automatically when the tab is hidden (browser rAF throttling).

const LOWER: Record<DetailLevel, DetailLevel | null> = { high: 'medium', medium: 'low', low: null };

export function PerfManager({ children }: { children: React.ReactNode }) {
  const lastChange = useRef(0);
  return (
    <PerformanceMonitor
      ms={500}
      iterations={6}
      bounds={() => [58, 1000]}
      onDecline={() => {
        const { settings, update } = useSettings.getState();
        if (!settings.autoLowerDetail || Date.now() - lastChange.current < 5_000) return;
        const next = LOWER[settings.detailLevel];
        if (!next) return;
        lastChange.current = Date.now();
        update({ detailLevel: next });
        useConnection.getState().addWarning({
          code: 'DETAIL_LOWERED',
          message: `Máy đang chạy chậm — đã giảm mức chi tiết bối cảnh xuống "${next === 'low' ? 'Thấp' : 'Vừa'}". Văn phòng không bị ảnh hưởng.`,
        });
      }}
    >
      {children}
    </PerformanceMonitor>
  );
}
