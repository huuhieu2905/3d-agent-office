import { useEffect } from 'react';
import { useUi } from '../state/ui';
import { useSettings } from '../state/settings';
import { useBuild } from '../state/build';

// T118 / FR-070: switch overview ⇄ first person (button or V). The overview camera pose is remembered
// by OverviewCamera; the choice is saved in Settings.camera.

export function useCameraHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code !== 'KeyV' || e.metaKey || e.ctrlKey) return;
      toggleCamera();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Set once the user switches camera, so the saved setting (loaded asynchronously) never overrides it. */
export let userChoseCamera = false;

export function toggleCamera() {
  userChoseCamera = true;
  if (useBuild.getState().active) return; // build mode needs the overview
  const next = useUi.getState().camera === 'overview' ? 'first_person' : 'overview';
  useUi.getState().setCamera(next);
  useSettings.getState().update({ camera: next });
}

export function CameraToggle() {
  const camera = useUi((s) => s.camera);
  const building = useBuild((s) => s.active);
  return (
    <button className="btn" onClick={toggleCamera} disabled={building} title="Đổi góc nhìn (phím V)">
      {camera === 'overview' ? '🚶 Góc nhìn thứ nhất' : '🗺 Toàn cảnh'}
    </button>
  );
}

export function FirstPersonHelp() {
  const camera = useUi((s) => s.camera);
  if (camera !== 'first_person') return null;
  return (
    <div className="fp-help panel small">
      Bấm vào cảnh để điều khiển · <kbd>W</kbd>
      <kbd>A</kbd>
      <kbd>S</kbd>
      <kbd>D</kbd> đi lại · <kbd>Shift</kbd> đi nhanh · nhắm vào nhân viên rồi bấm để trò chuyện · <kbd>Esc</kbd> nhả chuột ·{' '}
      <kbd>V</kbd> về toàn cảnh
    </div>
  );
}
