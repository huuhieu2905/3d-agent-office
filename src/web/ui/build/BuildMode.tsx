import { useEffect, useRef, useState } from 'react';
import { CATALOG, isWallMounted, snap } from '@shared/catalog';
import { PictureError, preparePicture, uploadPicture } from './picture';
import { moveIsValid } from '../../scene/interaction/DragLayer';
import { FLOOR_MAX, FLOOR_MIN, PLACEABLE_TYPES, type OfficeLayout, type PlacedItem } from '@shared/domain';
import { floorSizeValid, frameHeight, frameHeightRange, validateLayout } from '@shared/layout-validation';
import { api, ApiError } from '../../api/client';
import { useBuild } from '../../state/build';
import { useUi } from '../../state/ui';
import { useSettings } from '../../state/settings';

// T102 / FR-050..053: palette, rotate (R), delete (Delete/Backspace), undo/redo (⌘Z / ⇧⌘Z), save/cancel.
// 002 US2 (U-3): selected-item toolbar, arrow keys move it 0.05 m (Shift: 0.5 m), seating saved with the layout.

export const LAYOUT_CHANGED = 'agent-office:layout-changed';

export function BuildButton() {
  const active = useBuild((s) => s.active);
  const begin = useBuild((s) => s.begin);
  if (active) return null;
  return (
    <button
      className="btn"
      data-testid="build-toggle"
      onClick={() =>
        api<OfficeLayout>('/api/layout')
          .then((l) => {
            useUi.getState().setCamera('overview');
            if (useSettings.getState().settings.camera !== 'overview') useSettings.getState().update({ camera: 'overview' });
            begin(l);
          })
          .catch(() => undefined)
      }
    >
      🛠 Build
    </button>
  );
}

export function BuildMode() {
  const s = useBuild();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!s.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const st = useBuild.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (e.key === 'r' || e.key === 'R') {
        if (st.selectedId) st.rotateSelected();
        else st.rotate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        st.removeSelected();
      } else if (e.key === 'Escape') {
        // 006: that Esc closes the chat, or a dialog already used it (useEscapeToClose); one Esc does one thing.
        if (e.defaultPrevented || useUi.getState().openConversationId !== null) return;
        if (st.palette) st.setPalette(null);
        else st.select(null);
      } else if (e.key.startsWith('Arrow') && st.selectedId && st.draft) {
        e.preventDefault();
        const it = st.draft.items.find((i) => i.id === st.selectedId);
        if (!it) return;
        const step = e.shiftKey ? 0.5 : 0.05;
        if (isWallMounted(it.type)) {
          // 008: ←/→ slide a frame along its wall, ↑/↓ raise or lower it (refused when the result is invalid).
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const h = snap(frameHeight(it) + (e.key === 'ArrowUp' ? step : -step), 0.05);
            if (frameHeightValid(st.draft, it.id, h)) st.setFrameHeight(it.id, h);
            return;
          }
          const d = e.key === 'ArrowLeft' ? -step : step;
          const ns = it.rotation === 0 || it.rotation === 180;
          const pos = ns ? { x: snap(it.pos.x + d, 0.05), z: it.pos.z } : { x: it.pos.x, z: snap(it.pos.z + d, 0.05) };
          if (moveIsValid(st.draft, it.id, pos)) st.move(it.id, pos);
          return;
        }
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dz = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const pos = { x: snap(it.pos.x + dx, 0.05), z: snap(it.pos.z + dz, 0.05) };
        if (moveIsValid(st.draft, it.id, pos)) st.move(it.id, pos);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.active]);

  if (!s.active || !s.draft) return null;

  async function save() {
    if (!s.draft) return;
    setSaving(true);
    setError(null);
    try {
      await api('/api/layout', { method: 'PUT', json: { layout: s.draft, seating: s.seating, meetingSeating: s.meetingSeating } });
      window.dispatchEvent(new CustomEvent(LAYOUT_CHANGED));
      s.end();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the layout');
    } finally {
      setSaving(false);
    }
  }

  const problems = s.validation ? Object.values(s.validation.reasons) : [];
  const blockers = s.resizeBlockers;
  const selected = s.selectedId ? s.draft.items.find((i) => i.id === s.selectedId) : undefined;
  return (
    <div className="build panel" role="toolbar" aria-label="Build mode">
      <div className="build-title">🛠 Build mode</div>
      <div className="palette">
        {PLACEABLE_TYPES.map((t) => (
          <button
            key={t}
            data-testid={`palette-${t}`}
            className={`palette-item ${s.palette === t ? 'active' : ''}`}
            onClick={() => s.setPalette(s.palette === t ? null : t)}
          >
            {CATALOG[t].label}
          </button>
        ))}
      </div>
      {s.palette && !selected ? (
        // 007 US1: while placing, the hint line becomes the placing controls (same row, so the toolbar never grows).
        <div className="muted small" role="group" aria-label="Placing">
          <strong>{CATALOG[s.palette].label}</strong>: click the floor to place it · <kbd>R</kbd> rotates{' '}
          <button className="btn" data-testid="build-rotate-placing" onClick={s.rotate}>
            ⟳ Rotate <kbd>R</kbd>
          </button>
        </div>
      ) : (
        <div className="muted small">
          Pick an item in the palette, then click the floor to place it · click an item to select it, hold and drag to move it anywhere (hold{' '}
          <kbd>Shift</kbd> to snap to the 0.5 m grid) · right-click the selected item to delete it · drag an employee onto a desk or a meeting-table seat to seat them, onto an occupied one to swap · <kbd>Esc</kbd>
          cancels a drag · <kbd>⌘Z</kbd>/<kbd>⇧⌘Z</kbd> undo/redo
        </div>
      )}
      {selected && (
        <div className="build-selected" role="group" aria-label="Selected item">
          <strong>{CATALOG[selected.type].label}</strong>
          <span className="muted small">{isWallMounted(selected.type) ? '←/→ along the wall · ↑/↓ height (5 cm)' : 'arrows: move 5 cm'}</span>
          <button className="btn" onClick={s.rotateSelected}>
            ⟳ Rotate <kbd>R</kbd>
          </button>
          {isWallMounted(selected.type) && <FrameHeight item={selected} />}
          {isWallMounted(selected.type) && <FramePicture id={selected.id} picture={selected.picture} />}
          <button className="btn" onClick={s.removeSelected}>
            Delete
          </button>
          <button className="btn" onClick={() => s.select(null)}>
            Deselect
          </button>
        </div>
      )}
      <FloorSize width={s.draft.floor.width} depth={s.draft.floor.depth} />
      {blockers.length > 0 && (
        <button
          type="button"
          className="link send-failed"
          onClick={() => {
            // Walk through the items in the way, one per click (U-4).
            const i = Math.max(0, blockers.indexOf(s.selectedId ?? '') + 1) % blockers.length;
            s.select(blockers[i]!);
          }}
        >
          Can't shrink: {blockers.length} item(s) in the way (click to step through them)
        </button>
      )}
      {problems.length > 0 && <div className="send-failed">⚠ {problems[0]}{problems.length > 1 ? ` (+${problems.length - 1})` : ''}</div>}
      {error && <div className="send-failed">{error}</div>}
      <div className="modal-actions">
        <button className="btn" onClick={s.undo} disabled={s.past.length === 0}>
          ↶
        </button>
        <button className="btn" onClick={s.redo} disabled={s.future.length === 0}>
          ↷
        </button>
        <button className="btn" onClick={s.end}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || problems.length > 0}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/** Would this frame be valid at height `h`? */
function frameHeightValid(draft: OfficeLayout, id: string, h: number): boolean {
  return !validateLayout({ ...draft, items: draft.items.map((i) => (i.id === id ? { ...i, height: h } : i)) }).reasons[id];
}

/** 008 US4 (contracts/ui.md U8-3): type the selected frame's height. */
function FrameHeight({ item }: { item: PlacedItem }) {
  const draft = useBuild((st) => st.draft);
  const setFrameHeight = useBuild((st) => st.setFrameHeight);
  const current = frameHeight(item);
  const [text, setText] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(String(current)), [current]);
  const range = frameHeightRange(item.type);
  const apply = (v: string) => {
    setText(v);
    const h = Number(v.replace(',', '.'));
    if (!draft || !Number.isFinite(h) || Math.abs(h / 0.05 - Math.round(h / 0.05)) > 1e-6 || !frameHeightValid(draft, item.id, h)) {
      setError(`${range.min}–${range.max} m in 5 cm steps, not overlapping another picture`);
      return;
    }
    setError(null);
    setFrameHeight(item.id, snap(h, 0.05));
  };
  return (
    <label className="small">
      Height (m)
      <input
        type="number"
        data-testid="frame-height-input"
        min={range.min}
        max={range.max}
        step={0.05}
        value={text}
        aria-invalid={!!error}
        className={error ? 'invalid' : ''}
        onChange={(e) => apply(e.target.value)}
      />
      {error && (
        <span className="send-failed" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/** 007 US5 (contracts/ui-build.md U7-3): replace or reset the picture of the selected frame. */
function FramePicture({ id, picture }: { id: string; picture?: string }) {
  const setPicture = useBuild((st) => st.setPicture);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPicture(id, await uploadPicture(await preparePicture(file)));
    } catch (e) {
      setError(e instanceof PictureError ? e.message : 'Could not read this image');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden data-testid="frame-picture-input" onChange={(e) => void choose(e.target.files?.[0])} />
      <button className="btn" data-testid="frame-change-picture" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : 'Change picture'}
      </button>
      {picture && (
        <button className="btn" data-testid="frame-reset-picture" disabled={busy} onClick={() => setPicture(id, undefined)}>
          Reset picture
        </button>
      )}
      {error && (
        <span className="send-failed" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

/** US4 / U-4: office length and width, 6–40 m in 0.5 m steps; applied to the draft as you type. */
function FloorSize({ width, depth }: { width: number; depth: number }) {
  const resize = useBuild((st) => st.resizeFloor);
  const [w, setW] = useState(String(width));
  const [d, setD] = useState(String(depth));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setW(String(width)), [width]);
  useEffect(() => setD(String(depth)), [depth]);
  const apply = (nw: string, nd: string) => {
    const a = Number(nw.replace(',', '.'));
    const b = Number(nd.replace(',', '.'));
    if (!floorSizeValid(a) || !floorSizeValid(b)) {
      setError(`${FLOOR_MIN}–${FLOOR_MAX} m, in 0.5 m steps`);
      return;
    }
    setError(null);
    resize(a, b);
  };
  const bad = (v: string) => !floorSizeValid(Number(v.replace(',', '.')));
  return (
    <div className="floor-size" role="group" aria-label="Office size">
      <label>
        Length (m)
        <input
          id="floor-width"
          data-testid="floor-width-input"
          type="number"
          min={FLOOR_MIN}
          max={FLOOR_MAX}
          step={0.5}
          value={w}
          aria-invalid={bad(w)}
          className={bad(w) ? 'invalid' : ''}
          onChange={(e) => {
            setW(e.target.value);
            apply(e.target.value, d);
          }}
        />
      </label>
      <label>
        Width (m)
        <input
          id="floor-depth"
          data-testid="floor-depth-input"
          type="number"
          min={FLOOR_MIN}
          max={FLOOR_MAX}
          step={0.5}
          value={d}
          aria-invalid={bad(d)}
          className={bad(d) ? 'invalid' : ''}
          onChange={(e) => {
            setD(e.target.value);
            apply(w, e.target.value);
          }}
        />
      </label>
      {error && (
        <span className="send-failed" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
