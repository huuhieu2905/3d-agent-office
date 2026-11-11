import { useEffect, useState } from 'react';
import { OFFICE_LIMIT, type Project, type ProjectConversations } from '@shared/domain';
import { ApiError, api } from '../../api/client';
import { pickLeaver } from '@shared/office';
import { useEmployees } from '../../state/employees';
import { useUi } from '../../state/ui';
import { ModelPicker } from './ModelPicker';
import { useEscapeToClose } from '../useEscapeToClose';
import { PROJECTS_CHANGED, ProjectDialog } from '../projects/ProjectDialog';

// T072 + T082 / FR-026, FR-032: hire = first request + model + a REQUIRED project (existing or newly created).
// 009: or continue one of the project's existing conversations; the office holds at most OFFICE_LIMIT members.

const NEW = '__new__';
const FULL = `The office is full (${OFFICE_LIMIT}/${OFFICE_LIMIT})`;
const BUSY_TEXT = `${FULL} and everyone is busy. Remove an employee from the office before hiring another.`;
const GONE_TEXT = 'This conversation no longer exists in the Antigravity App.';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function ago(iso: string): string {
  const min = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (min > -60) return rtf.format(min, 'minute');
  if (min > -60 * 24) return rtf.format(Math.round(min / 60), 'hour');
  if (min > -60 * 24 * 14) return rtf.format(Math.round(min / 1440), 'day');
  return rtf.format(Math.round(min / 10080), 'week');
}

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
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [list, setList] = useState<ProjectConversations | null>(null);
  const [listState, setListState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [serverFull, setServerFull] = useState(false);
  useEscapeToClose(onClose);
  const openConversation = useUi((s) => s.openConversation);
  const storeMembers = useEmployees((s) => Object.values(s.byId).filter((e) => e.visible && !e.isSubagent).length);
  const members = list?.members ?? storeMembers;
  const full = serverFull || members >= OFFICE_LIMIT;
  // 009 R8: same rule as the server, on the client's view of the office (announced, the server decides).
  const leaver = useEmployees((s) => {
    const inOffice = Object.values(s.byId).filter((e) => e.visible && !e.isSubagent);
    const id = pickLeaver(inOffice.map((e) => ({ id: e.conversationId, lastActivityAt: e.lastActivityAt, memberSince: null, visualState: e.visualState })));
    return id ? s.byId[id] : undefined;
  });
  const noRoom = full && (serverFull || !leaver);
  const pickedItem = list?.conversations.find((c) => c.id === picked);

  function load() {
    api<Project[]>('/api/projects')
      .then((p) => setProjects(p.filter((x) => x.id !== 'outside-of-project')))
      .catch(() => undefined);
  }
  useEffect(load, []);

  function loadConversations() {
    if (!projectId) return;
    setListState('loading');
    setList(null);
    setPicked(null);
    setFilter('');
    api<ProjectConversations>(`/api/projects/${projectId}/conversations`)
      .then((l) => {
        setList(l);
        setListState('ready');
      })
      .catch(() => setListState('unavailable'));
  }
  useEffect(() => {
    if (mode === 'existing') loadConversations();
  }, [projectId, mode]);

  async function join() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/conversations/${picked}/join`, { method: 'POST', json: deskId ? { deskId } : {} });
      onClose();
      openConversation(picked);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OFFICE_FULL') setServerFull(true);
      else if (err instanceof ApiError && err.status === 404) {
        setError(GONE_TEXT);
        loadConversations();
      } else setError('Could not hire this employee. Check that the Antigravity App is open.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (mode === 'existing') return join();
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
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OFFICE_FULL') setServerFull(true);
      else setError('Could not hire a new employee. Check that the Antigravity App is open.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-label="Hire a new employee" onClick={(e) => e.stopPropagation()}>
        <h3>
          Hire a new employee{' '}
          <span className="muted small" data-testid="hire-office-count">
            {members}/{OFFICE_LIMIT} in the office
          </span>
        </h3>
        {full && !(mode === 'existing' && pickedItem?.inOffice) && (
          <div className={noRoom ? 'send-failed' : 'muted'} role={noRoom ? 'alert' : 'status'} data-testid="hire-office-full">
            {noRoom ? BUSY_TEXT : `${FULL}. Hiring will send ${leaver!.name} (last active ${ago(leaver!.lastActivityAt)}) out of the office.`}
          </div>
        )}
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
        {projectId && (
          <div className="modal-actions" role="radiogroup" aria-label="Conversation">
            <button className={`btn${mode === 'new' ? ' btn-primary' : ''}`} role="radio" aria-checked={mode === 'new'} data-testid="hire-mode-new" onClick={() => setMode('new')}>
              New conversation
            </button>
            <button
              className={`btn${mode === 'existing' ? ' btn-primary' : ''}`}
              role="radio"
              aria-checked={mode === 'existing'}
              data-testid="hire-mode-existing"
              onClick={() => setMode('existing')}
            >
              Existing conversation
            </button>
          </div>
        )}
        {mode === 'new' ? (
          <>
            <label>
              First task for the employee
              <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            </label>
            <label>
              Model
              <ModelPicker value={model} onChange={(id) => setModel(id)} />
            </label>
          </>
        ) : (
          <ConversationList
            state={listState}
            items={list?.conversations ?? []}
            picked={picked}
            onPick={setPicked}
            filter={filter}
            onFilter={setFilter}
          />
        )}
        {error && <div className="send-failed">{error}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={
              busy ||
              (mode === 'new' ? noRoom || !text.trim() || !model || !projectId : !pickedItem || (noRoom && !pickedItem.inOffice))
            }
            onClick={() => void submit()}
          >
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

/** 009 contracts/ui.md: the project's conversations from the App, single choice, filter above 10 items. */
function ConversationList(p: {
  state: 'loading' | 'ready' | 'unavailable';
  items: ProjectConversations['conversations'];
  picked: string | null;
  onPick(id: string): void;
  filter: string;
  onFilter(v: string): void;
}) {
  if (p.state === 'loading') return <p className="muted">Loading conversations…</p>;
  if (p.state === 'unavailable') return <p className="send-failed">The Antigravity App is not connected.</p>;
  if (p.items.length === 0) return <p className="muted">No conversations in this project yet.</p>;
  const q = p.filter.trim().toLowerCase();
  const shown = q ? p.items.filter((c) => c.title.toLowerCase().includes(q)) : p.items;
  return (
    <>
      {p.items.length > 10 && (
        <input aria-label="Filter by title" placeholder="Filter by title…" data-testid="hire-filter" value={p.filter} onChange={(e) => p.onFilter(e.target.value)} />
      )}
      <ul className="hire-list" role="radiogroup" aria-label="Existing conversations" data-testid="hire-conversation-list">
        {shown.map((c) => (
          <li key={c.id}>
            <label className="row" data-testid="hire-conversation-item">
              <input type="radio" name="hire-conversation" checked={p.picked === c.id} onChange={() => p.onPick(c.id)} />
              <span className="row-name">{c.title}</span>
              <span className="muted small">{c.inOffice ? 'in the office' : ago(c.lastActivityAt)}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
