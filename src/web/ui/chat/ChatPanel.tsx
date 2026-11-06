import { useEffect, useRef } from 'react';
import type { Step, UserInputPart } from '@shared/domain';
import { api } from '../../api/client';
import { socket } from '../../api/ws';
import { useEmployees } from '../../state/employees';
import { useSettings } from '../../state/settings';
import { useSteps } from '../../state/steps';
import { useUi } from '../../state/ui';
import { Composer } from './Composer';
import { StepView } from './StepView';
import { ComposerExtensions } from './extensions';

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
  const lastModel = null;

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
      <Composer
        key={id}
        busy={busy}
        defaultModel={lastModel ?? defaultModel}
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
