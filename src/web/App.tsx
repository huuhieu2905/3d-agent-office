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

function ConnectionBanner() {
  const { app, serverOnline, warnings, dismissWarning } = useConnection();
  let text: string | null = null;
  let tone: 'warn' | 'error' = 'warn';
  if (!getSessionToken()) {
    text = 'Thiếu mã phiên. Hãy mở đúng đường link mà lệnh `npm start` in ra.';
    tone = 'error';
  } else if (!serverOnline) {
    text = 'Mất kết nối tới server Agent Office — đang thử lại…';
    tone = 'error';
  } else if (app.kind === 'searching') {
    text = 'Chưa kết nối được Antigravity App — hãy mở App.';
  } else if (app.kind === 'error') {
    text = 'Đang kết nối lại Antigravity App…';
  }
  return (
    <div className="banners" role="status" aria-live="polite">
      {text && <div className={`banner banner-${tone}`}>{text}</div>}
      {warnings.map((w) => (
        <div key={w.code} className="banner banner-warn">
          {w.message}
          <button onClick={() => dismissWarning(w.code)} aria-label="Đóng">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function App() {
  const theme = useSettings((s) => s.settings.theme);
  const hireDeskId = useUi((s) => s.hireDeskId);
  const setHireDesk = useUi((s) => s.setHireDesk);
  return (
    <div className={`app theme-${theme}`}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [10, 12, 14], fov: 45 }}>
        <color attach="background" args={[theme === 'dark' ? '#0f1420' : '#dfe9f3']} />
        <Suspense fallback={null}>
          <OfficeScene theme={theme} />
        </Suspense>
      </Canvas>
      <ConnectionBanner />
      <div className="hud-top-right">
        <BuildButton />
        <QuotaButton />
        <ProjectButton />
        <HireButton />
      </div>
      <ChatPanel />
      <QuotaPanel />
      <BuildMode />
      {hireDeskId && <HireDialog deskId={hireDeskId} onClose={() => setHireDesk(null)} />}
      <div className="hud-left">
        <AddDeskHint />
        <ProjectLegend />
        <OverflowList />
      </div>
    </div>
  );
}
