import { useEffect, useState } from 'react';
import type { Project } from '@shared/domain';
import { api } from '../../api/client';
import { useUi } from '../../state/ui';
import { ModelPicker } from './ModelPicker';

// T072 / FR-026: "Tuyển nhân viên mới" — first request, model and project → new conversation at a desk.

export function HireButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary hire" onClick={() => setOpen(true)}>
        + Tuyển nhân viên
      </button>
      {open && <HireDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function HireDialog({ onClose, deskId }: { onClose(): void; deskId?: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('default-cli-project');
  const [model, setModel] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openConversation = useUi((s) => s.openConversation);

  useEffect(() => {
    api<Project[]>('/api/projects')
      .then((p) => {
        const usable = p.filter((x) => x.id !== 'outside-of-project');
        setProjects(usable);
        if (!usable.some((x) => x.id === 'default-cli-project') && usable[0]) setProjectId(usable[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function submit() {
    if (!text.trim() || !model) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ conversationId: string }>('/api/conversations', {
        method: 'POST',
        json: { parts: [{ text: text.trim() }], model, projectId, ...(deskId ? { deskId } : {}) },
      });
      onClose();
      openConversation(res.conversationId);
    } catch {
      setError('Không tuyển được nhân viên mới. Hãy kiểm tra Antigravity App đang mở.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-label="Tuyển nhân viên mới" onClick={(e) => e.stopPropagation()}>
        <h3>Tuyển nhân viên mới</h3>
        <label>
          Việc đầu tiên giao cho nhân viên
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
        <label>
          Dự án
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <ModelPicker value={model} onChange={(id) => setModel(id)} />
        </label>
        {error && <div className="send-failed">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button className="btn btn-primary" disabled={busy || !text.trim() || !model} onClick={() => void submit()}>
            {busy ? 'Đang tuyển…' : 'Tuyển'}
          </button>
        </div>
      </div>
    </div>
  );
}
