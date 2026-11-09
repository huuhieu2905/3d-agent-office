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

// T067: right-hand chat for the clicked employee — full history, live updates, send, stop.

const STATE_LABEL: Record<string, string> = {
  idle: 'Đang rảnh',
  thinking: 'Đang suy nghĩ',
  working: 'Đang làm việc',
  waiting_for_boss: 'Chờ sếp',
  error: 'Gặp lỗi',
  stopped: 'Đã dừng',
  unknown: 'Không rõ',
  disconnected: 'Mất kết nối',
};

export function ChatPanel() {
  const id = useUi((s) => s.openConversationId);
  const close = useUi((s) => s.closeConversation);
  const employee = useEmployees((s) => (id ? s.byId[id] : undefined));
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
      setModelNote({ kind: 'saved', text: 'Đã lưu cho cuộc trò chuyện này' });
    } catch {
      setModelNote({ kind: 'error', text: 'Chưa lưu được lựa chọn model. Model vẫn dùng cho lượt này.' });
    }
  }

  return (
    <aside className="chat panel" aria-label="Trò chuyện">
      <header className="chat-head">
        <span className="tag-dot" style={{ background: employee?.projectColor ?? '#999' }} />
        <div className="chat-title">
          <strong>{employee?.name ?? 'Nhân viên'}</strong>
          <span className={`state state-${employee?.visualState}`}>{STATE_LABEL[employee?.visualState ?? 'unknown']}</span>
        </div>
        <button className="icon" onClick={close} aria-label="Đóng">
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
        {!steps && <div className="muted">Đang tải…</div>}
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
    </aside>
  );
}
