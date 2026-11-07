import { PerformanceMonitor } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CONCEPT } from '../../theme/concept';
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
      <RenderQuality />
      {children}
    </PerformanceMonitor>
  );
}

/**
 * 002 US6 / T073 (R2-07): render quality per detail level. Low = hard shadows, medium = filtered (PCF)
 * shadows, high = soft (VSM) shadows like the concept preview. The office always keeps its shadows; the
 * surroundings are what PerfManager lowers first. Tone mapping follows the concept exposure.
 * (SSAO for "high" was left out: it needs a post-processing pipeline the app does not have.)
 */
const SHADOW: Record<DetailLevel, THREE.ShadowMapType> = { low: THREE.BasicShadowMap, medium: THREE.PCFShadowMap, high: THREE.VSMShadowMap };

function RenderQuality() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const detail = useSettings((s) => s.settings.detailLevel);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = CONCEPT.exposure;
    const type = SHADOW[detail];
    if (gl.shadowMap.type === type) return;
    gl.shadowMap.type = type;
    gl.shadowMap.needsUpdate = true;
    // Shadow-map type changes need the shaders rebuilt.
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
      else if (m) m.needsUpdate = true;
    });
  }, [gl, scene, detail]);
  return null;
}
