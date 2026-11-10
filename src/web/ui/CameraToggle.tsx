import { useEffect, useState } from 'react';
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
    <button className="btn" onClick={toggleCamera} disabled={building} title="Switch view (V key)">
      {camera === 'overview' ? '🚶 First person' : '🗺 Overview'}
    </button>
  );
}

// 006 US4 / FR-014..017: whole-page fullscreen (panels stay usable), button or F, in both views.
const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
let reportFullscreenError: (() => void) | null = null;

function toggleFullscreen() {
  const req = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  req.catch(() => reportFullscreenError?.());
}

export function useFullscreenHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.code !== 'KeyF' || e.metaKey || e.ctrlKey || e.altKey) return;
      toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function FullscreenToggle() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement); // also catches Esc / F11 / browser controls
    document.addEventListener('fullscreenchange', sync);
    reportFullscreenError = () => setFailed(true);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      reportFullscreenError = null;
    };
  }, []);
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setFailed(false), 3000);
    return () => clearTimeout(t);
  }, [failed]);
  const supported = document.fullscreenEnabled;
  return (
    <>
      <button
        className="btn"
        data-testid="fullscreen-toggle"
        aria-pressed={on}
        disabled={!supported}
        onClick={toggleFullscreen}
        title={supported ? 'Fullscreen (F key)' : 'Fullscreen is not available in this browser'}
      >
        {on ? 'Exit fullscreen' : '⛶ Fullscreen'}
      </button>
      {failed && (
        <span className="panel small" role="status">
          Fullscreen is not available
        </span>
      )}
    </>
  );
}

export function FirstPersonHelp() {
  const camera = useUi((s) => s.camera);
  if (camera !== 'first_person') return null;
  return (
    <div className="fp-help panel small">
      Click the scene to take control · <kbd>W</kbd>
      <kbd>A</kbd>
      <kbd>S</kbd>
      <kbd>D</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> use object · aim at an employee and click to chat · <kbd>Esc</kbd> release mouse ·{' '}
      <kbd>V</kbd> back to overview · <kbd>F</kbd> fullscreen
    </div>
  );
}
