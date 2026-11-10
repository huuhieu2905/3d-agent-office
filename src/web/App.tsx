import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { useConnection } from './state/connection';
import { useSettings } from './state/settings';
import { getSessionToken } from './api/client';
import { OfficeScene } from './scene/OfficeScene';
import { OverflowList } from './ui/OverflowList';
import { ProjectLegend } from './ui/ProjectLegend';
import { ChatPanel } from './ui/chat/ChatPanel';
import { HireButton, HireDialog } from './ui/chat/HireDialog';
import { useUi } from './state/ui';
import { QuotaButton, QuotaPanel } from './ui/quota/QuotaPanel';
import { ProjectButton } from './ui/projects/ProjectDialog';
import { BuildButton, BuildMode } from './ui/build/BuildMode';
import { AddDeskHint } from './ui/build/AddDeskHint';
import { SettingsButton, ThemeToggle, WeatherBadge } from './ui/settings/SettingsPanel';
import { PerfManager } from './scene/perf/PerfManager';
import { useEffect } from 'react';
import { CameraToggle, FirstPersonHelp, FullscreenToggle, useCameraHotkey, useFullscreenHotkey, userChoseCamera } from './ui/CameraToggle';
import { Crosshair, FirstPersonHint } from './scene/cameras/FirstPerson';

function ConnectionBanner() {
  const { app, serverOnline, warnings, dismissWarning } = useConnection();
  let text: string | null = null;
  let tone: 'warn' | 'error' = 'warn';
  if (!getSessionToken()) {
    text = 'Missing session token. Open the exact link printed by `npm start`.';
    tone = 'error';
  } else if (!serverOnline) {
    text = 'Lost connection to the Agent Office server — retrying…';
    tone = 'error';
  } else if (app.kind === 'searching') {
    text = 'Not connected to the Antigravity App — please open the App.';
  } else if (app.kind === 'error') {
    text = 'Reconnecting to the Antigravity App…';
  }
  return (
    <div className="banners" role="status" aria-live="polite">
      {text && <div className={`banner banner-${tone}`}>{text}</div>}
      {warnings.map((w) => (
        <div key={w.code} className="banner banner-warn">
          {w.message}
          <button onClick={() => dismissWarning(w.code)} aria-label="Close">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const theme = useSettings((s) => s.settings.theme);
  const serverOnline = useConnection((s) => s.serverOnline);
  const loaded = useSettings((s) => s.loaded);
  useEffect(() => {
    if (serverOnline && !loaded) void useSettings.getState().load();
  }, [serverOnline, loaded]);
  useCameraHotkey();
  useFullscreenHotkey();
  const cameraMode = useUi((s) => s.camera);
  const savedCamera = useSettings((s) => (s.loaded ? s.settings.camera : null));
  useEffect(() => {
    if (savedCamera && !userChoseCamera) useUi.getState().setCamera(savedCamera);
  }, [savedCamera]);
  const hireDeskId = useUi((s) => s.hireDeskId);
  const setHireDesk = useUi((s) => s.setHireDesk);
  return (
    <div className={`app theme-${theme}`}>
      {/* 006 FR-012: right-click is a build-mode delete, never the browser menu. */}
      <Canvas shadows dpr={[1, 2]} camera={{ position: [10, 12, 14], fov: 45, far: 600 }} onContextMenu={(e) => e.preventDefault()}>
        <PerfManager>
          <Suspense fallback={null}>
            <OfficeScene theme={theme} />
          </Suspense>
        </PerfManager>
      </Canvas>
      <ConnectionBanner />
      <div className="hud-top-right">
        <CameraToggle />
        <FullscreenToggle />
        <ThemeToggle />
        <SettingsButton />
        <BuildButton />
        <QuotaButton />
        <ProjectButton />
        <HireButton />
      </div>
      <ChatPanel />
      <QuotaPanel />
      <BuildMode />
      <WeatherBadge />
      <FirstPersonHelp />
      {cameraMode === 'first_person' && <Crosshair />}
      {cameraMode === 'first_person' && <FirstPersonHint />}
      {hireDeskId && <HireDialog deskId={hireDeskId} onClose={() => setHireDesk(null)} />}
      <div className="hud-left">
        <AddDeskHint />
        <ProjectLegend />
        <OverflowList />
      </div>
    </div>
  );
}
