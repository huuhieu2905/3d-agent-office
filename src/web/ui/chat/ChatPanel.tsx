import { useEffect, useRef, useState } from 'react';
import { latestRequestedModel } from '@shared/model';
import type { Step, UserInputPart } from '@shared/domain';
import { api } from '../../api/client';
import { socket } from '../../api/ws';
import { useEmployees } from '../../state/employees';
import { useSettings } from '../../state/settings';
import { useSteps } from '../../state/steps';
import { useUi } from '../../state/ui';
import { Composer } from './Composer';
import { useModels } from './ModelPicker';
import { resolveModel } from './resolve-model';
import { StepView } from './StepView';
import { ComposerExtensions } from './extensions';
import { PermissionPrompt } from './PermissionPrompt';
import { QuestionPrompt } from './QuestionPrompt';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import type { Employee } from '@shared/domain';

// T067: right-hand chat for the clicked employee — full history, live updates, send, stop.

const STATE_LABEL: Record<string, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  working: 'Working',
  waiting_for_boss: 'Waiting for you',
  error: 'Error',
  stopped: 'Stopped',
  unknown: 'Unknown',
  disconnected: 'Disconnected',
};

/** 004 FR-015: states that block deleting (the server re-checks; this only disables the button). */
const BUSY = new Set(['working', 'thinking', 'waiting_for_boss']);

/** Subagents of `id` (any depth) among the employees the client knows. */
// shortcut: counts only employees on screen (≤ MAX_VISIBLE); the server checks the full tree before deleting.
function subagentsOf(id: string, byId: Record<string, Employee>): Employee[] {
  const out: Employee[] = [];
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of Object.values(byId)) {
      if (e.parentId && ids.has(e.parentId) && !ids.has(e.conversationId)) {
        ids.add(e.conversationId);
        out.push(e);
        grew = true;
      }
    }
  }
  return out;
}

export function ChatPanel() {
  const id = useUi((s) => s.openConversationId);
  const close = useUi((s) => s.closeConversation);
  const employee = useEmployees((s) => (id ? s.byId[id] : undefined));
  const byId = useEmployees((s) => s.byId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const steps = useSteps((s) => (id ? s.byConversation[id] : undefined));
  const merge = useSteps((s) => s.merge);
  const defaultModel = useSettings((s) => s.settings.defaultModel);
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const models = useModels();
  // 002 US1: the pick shows at once; the server copy (employee.preferredModel) follows over WebSocket.
  const [picked, setPicked] = useState<{ id: string; modelId: string } | null>(null);
  const [modelNote, setModelNote] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);
  // Spec 003 T033: the question form stays (locked) after the App moves on, until the user closes it.
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  // 006 FR-007/008: Esc closes the chat, unless a popup over it (mention menu, delete dialog) used that Esc.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, close]);

  useEffect(() => {
    if (!modelNote || modelNote.kind !== 'saved') return;
    const t = setTimeout(() => setModelNote(null), 1500);
    return () => clearTimeout(t);
  }, [modelNote]);

  useEffect(() => {
    if (!id) return;
    stick.current = true;
    api<Step[]>(`/api/conversations/${id}/steps`)
      .then((s) => merge(id, s))
      .catch(() => undefined);
    socket.watch(id);
    return () => socket.unwatch(id);
  }, [id, merge]);

  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [steps]);

  if (!id) return null;
  const busy = employee?.visualState === 'working' || employee?.visualState === 'thinking';
  const subagents = subagentsOf(id, byId);
  const deleteBlocked = [employee, ...subagents].some((e) => !!e && BUSY.has(e.visualState));
  const pending = steps?.filter((s) => s.kind === 'permission_request' && s.status === 'WAITING').at(-1);
  const questionStep =
    steps
      ?.filter(
        (s) =>
          s.kind === 'question' &&
          s.question &&
          !dismissed.has(s.question.requestId) &&
          ((s.status === 'WAITING' && s.question.state === 'waiting') || s.question.requestId === openQuestion),
      )
      .at(-1) ?? null;
  if (questionStep?.question && questionStep.question.state === 'waiting' && openQuestion !== questionStep.question.requestId) {
    // Remember which question is on screen so it can lock instead of vanishing (render-time sync, no effect needed).
    setOpenQuestion(questionStep.question.requestId);
  }
  const resolved = resolveModel({
    preferredModel: (picked?.id === id ? picked.modelId : null) ?? employee?.preferredModel,
    currentModel: (steps && latestRequestedModel(steps)) ?? employee?.currentModel,
    defaultModel,
    models,
  });

  async function chooseModel(modelId: string) {
    const conversationId = id!;
    setPicked({ id: conversationId, modelId });
    try {
      await api(`/api/employees/${conversationId}/profile`, { method: 'PUT', json: { preferredModel: modelId } });
      setModelNote({ kind: 'saved', text: 'Saved for this conversation' });
    } catch {
      setModelNote({ kind: 'error', text: 'Could not save the model choice. It is still used for this turn.' });
    }
  }

  return (
    <aside className="chat panel" aria-label="Chat">
      <header className="chat-head">
        <span className="tag-dot" style={{ background: employee?.projectColor ?? '#999' }} />
        <div className="chat-title">
          <strong>{employee?.name ?? 'Employee'}</strong>
          <span className={`state state-${employee?.visualState}`}>{STATE_LABEL[employee?.visualState ?? 'unknown']}</span>
        </div>
        <button
          className="icon"
          data-testid="employee-delete"
          aria-label="Delete employee"
          disabled={deleteBlocked}
          title={deleteBlocked ? 'Stop the agent before deleting' : 'Delete employee (permanently deletes the conversation in the App)'}
          onClick={() => setConfirmDelete(true)}
        >
          🗑
        </button>
        <button className="icon" onClick={close} aria-label="Close">
          ×
        </button>
      </header>
      <div
        className="chat-list"
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {!steps && <div className="muted">Loading…</div>}
        {steps?.map((s) => <StepView key={s.index} step={s} />)}
      </div>
      {questionStep?.question ? (
        <QuestionPrompt
          key={questionStep.question.requestId}
          conversationId={id}
          question={questionStep.question}
          onDismiss={() => {
            const req = questionStep.question!.requestId;
            setDismissed((d) => new Set(d).add(req));
            setOpenQuestion(null);
          }}
        />
      ) : (
        pending && <PermissionPrompt key={pending.permission?.requestId} conversationId={id} step={pending} />
      )}
      <Composer
        key={id}
        busy={busy}
        model={resolved.modelId}
        modelInfo={models.find((m) => m.modelId === resolved.modelId)}
        modelUnavailable={resolved.unavailable}
        onModelChange={(m) => void chooseModel(m)}
        modelNote={modelNote}
        onSend={async (parts: UserInputPart[], model: string) => {
          stick.current = true;
          await api(`/api/conversations/${id}/messages`, { method: 'POST', json: { parts, model } });
        }}
        onStop={async () => {
          await api(`/api/conversations/${id}/cancel`, { method: 'POST' });
        }}
        renderExtensions={(ctx) => <ComposerExtensions conversationId={id} {...ctx} />}
      />
      {confirmDelete && (
        <ConfirmDeleteDialog
          conversationId={id}
          name={employee?.name ?? 'Employee'}
          subagents={subagents.length}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            close();
          }}
        />
      )}
    </aside>
  );
}
