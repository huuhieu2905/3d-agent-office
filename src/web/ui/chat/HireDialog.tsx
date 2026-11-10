import { useEffect, useState } from 'react';
import type { Project } from '@shared/domain';
import { api } from '../../api/client';
import { useUi } from '../../state/ui';
import { ModelPicker } from './ModelPicker';
import { useEscapeToClose } from '../useEscapeToClose';
import { PROJECTS_CHANGED, ProjectDialog } from '../projects/ProjectDialog';

// T072 + T082 / FR-026, FR-032: hire = first request + model + a REQUIRED project (existing or newly created).

const NEW = '__new__';

export function HireButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-primary hire" onClick={() => setOpen(true)}>
        + Hire employee
      </button>
      {open && <HireDialog onClose={() => setOpen(false)} />}
    </>
  );
}

export function HireDialog({ onClose, deskId }: { onClose(): void; deskId?: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeToClose(onClose);
  const openConversation = useUi((s) => s.openConversation);

  function load() {
    api<Project[]>('/api/projects')
      .then((p) => setProjects(p.filter((x) => x.id !== 'outside-of-project')))
      .catch(() => undefined);
  }
  useEffect(load, []);

  async function submit() {
    if (!text.trim() || !model || !projectId) return;
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
      setError('Could not hire a new employee. Check that the Antigravity App is open.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-label="Hire a new employee" onClick={(e) => e.stopPropagation()}>
        <h3>Hire a new employee</h3>
        <label>
          Project <span className="muted small">(required)</span>
          <select
            aria-label="Project"
            value={projectId}
            onChange={(e) => {
              if (e.target.value === NEW) setCreatingProject(true);
              else setProjectId(e.target.value);
            }}
          >
            <option value="" disabled>
              — Choose a project —
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.folderUri ? ` — ${decodeURIComponent(p.folderUri.replace('file://', '')).split('/').slice(-2).join('/')}` : ''}
              </option>
            ))}
            <option value={NEW}>+ New project…</option>
          </select>
        </label>
        <label>
          First task for the employee
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>
        <label>
          Model
          <ModelPicker value={model} onChange={(id) => setModel(id)} />
        </label>
        {error && <div className="send-failed">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !text.trim() || !model || !projectId} onClick={() => void submit()}>
            {busy ? 'Hiring…' : 'Hire'}
          </button>
        </div>
      </div>
      {creatingProject && (
        <div onClick={(e) => e.stopPropagation()}>
          <ProjectDialog
            onClose={() => setCreatingProject(false)}
            onCreated={(p) => {
              setProjects((list) => [...list, p]);
              setProjectId(p.id);
              window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED));
            }}
          />
        </div>
      )}
    </div>
  );
}
