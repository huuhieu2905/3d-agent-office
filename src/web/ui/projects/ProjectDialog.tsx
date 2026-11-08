import { useEffect, useState } from 'react';
import type { Project } from '@shared/domain';
import { api, ApiError } from '../../api/client';

// T082 / FR-031: create a project bound to a folder chosen from a folder browser (inside home only).

interface Listing {
  path: string;
  parent: string | null;
  home: string;
  dirs: { name: string; path: string }[];
}

export const PROJECTS_CHANGED = 'agent-office:projects-changed';

export function ProjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + Tạo project
      </button>
      {open && <ProjectDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProjectDialog({ onClose, onCreated }: { onClose(): void; onCreated?(p: Project): void }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(path?: string) {
    setError(null);
    try {
      const l = await api<Listing>(`/api/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`);
      setListing(l);
      if (!nameTouched) setName(l.path === l.home ? '' : (l.path.split('/').pop() ?? ''));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không mở được thư mục');
    }
  }
  useEffect(() => {
    void go();
  }, []); // once, on mount

  async function create() {
    if (!listing || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const p = await api<Project>('/api/projects', { method: 'POST', json: { name: name.trim(), folderPath: listing.path } });
      window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED));
      onCreated?.(p);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.appUnavailable ? 'Antigravity App chưa sẵn sàng.' : 'Không tạo được project.');
    } finally {
      setBusy(false);
    }
  }

  const rel = listing ? (listing.path === listing.home ? '~' : '~' + listing.path.slice(listing.home.length)) : '';
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-label="Tạo project" onClick={(e) => e.stopPropagation()}>
        <h3>Tạo project</h3>
        <label>
          Thư mục của project
          <div className="folder-path" title={listing?.path}>
            <button className="btn" disabled={!listing?.parent} onClick={() => listing?.parent && void go(listing.parent)} aria-label="Lên thư mục cha">
              ↑
            </button>
            <code>{rel || '…'}</code>
          </div>
        </label>
        <ul className="folder-list" role="listbox" aria-label="Thư mục con">
          {listing?.dirs.length === 0 && <li className="muted small">Không có thư mục con.</li>}
          {listing?.dirs.map((d) => (
            <li key={d.path}>
              <button className="row" onClick={() => void go(d.path)}>
                📁 <span className="row-name">{d.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <label>
          Tên project
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            placeholder="Ví dụ: Website công ty"
          />
        </label>
        {error && <div className="send-failed">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" disabled={busy || !listing || !name.trim()} onClick={() => void create()}>
            {busy ? 'Đang tạo…' : `Tạo project tại ${rel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
