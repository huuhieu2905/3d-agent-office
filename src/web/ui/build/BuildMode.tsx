import { useEffect, useState } from 'react';
import { CATALOG, snap } from '@shared/catalog';
import { moveIsValid } from '../../scene/interaction/DragLayer';
import { FLOOR_MAX, FLOOR_MIN, PLACEABLE_TYPES, type OfficeLayout } from '@shared/domain';
import { floorSizeValid } from '@shared/layout-validation';
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
      🛠 Xây dựng
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
        if (st.palette) st.setPalette(null);
        else st.select(null);
      } else if (e.key.startsWith('Arrow') && st.selectedId && st.draft) {
        e.preventDefault();
        const it = st.draft.items.find((i) => i.id === st.selectedId);
        if (!it) return;
        const step = e.shiftKey ? 0.5 : 0.05;
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
      await api('/api/layout', { method: 'PUT', json: { layout: s.draft, seating: s.seating } });
      window.dispatchEvent(new CustomEvent(LAYOUT_CHANGED));
      s.end();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không lưu được bố cục');
    } finally {
      setSaving(false);
    }
  }

  const problems = s.validation ? Object.values(s.validation.reasons) : [];
  const blockers = s.resizeBlockers;
  const selected = s.selectedId ? s.draft.items.find((i) => i.id === s.selectedId) : undefined;
  return (
    <div className="build panel" role="toolbar" aria-label="Chế độ xây dựng">
      <div className="build-title">🛠 Chế độ xây dựng</div>
      <div className="palette">
        {PLACEABLE_TYPES.map((t) => (
          <button key={t} className={`palette-item ${s.palette === t ? 'active' : ''}`} onClick={() => s.setPalette(s.palette === t ? null : t)}>
            {CATALOG[t].label}
          </button>
        ))}
      </div>
      <div className="muted small">
        Chọn đồ vật trong bảng rồi bấm lên sàn để đặt · bấm một đồ vật để chọn, giữ chuột và kéo để dời tới bất kỳ chỗ nào (giữ{' '}
        <kbd>Shift</kbd> để bám lưới 0,5 m) · kéo nhân viên thả vào bàn để xếp chỗ, thả vào bàn có người để đổi chỗ · <kbd>Esc</kbd> huỷ
        thao tác kéo · <kbd>⌘Z</kbd>/<kbd>⇧⌘Z</kbd> hoàn tác/làm lại
      </div>
      {selected && (
        <div className="build-selected" role="group" aria-label="Đồ vật đang chọn">
          <strong>{CATALOG[selected.type].label}</strong>
          <span className="muted small">mũi tên: dời 5 cm</span>
          <button className="btn" onClick={s.rotateSelected}>
            ⟳ Xoay <kbd>R</kbd>
          </button>
          <button className="btn" onClick={s.removeSelected}>
            Xoá
          </button>
          <button className="btn" onClick={() => s.select(null)}>
            Bỏ chọn
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
          Không thu nhỏ được: {blockers.length} đồ vật đang chắn (bấm để xem từng cái)
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
          Huỷ
        </button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving || problems.length > 0}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </div>
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
      setError(`Từ ${FLOOR_MIN} đến ${FLOOR_MAX} m, bước 0,5 m`);
      return;
    }
    setError(null);
    resize(a, b);
  };
  const bad = (v: string) => !floorSizeValid(Number(v.replace(',', '.')));
  return (
    <div className="floor-size" role="group" aria-label="Kích thước văn phòng">
      <label>
        Chiều dài (m)
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
        Chiều rộng (m)
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
