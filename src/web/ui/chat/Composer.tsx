import { useRef, useState } from 'react';
import type { ModelOption, UserInputPart } from '@shared/domain';
import { ModelPicker, quotaState } from './ModelPicker';

// 002 US1: the model is controlled by the chat panel (remembered per conversation), not kept here.

// T070: multi-line input, Enter sends, Shift+Enter newline; keeps text and offers "Retry" on failure;
// shows "Dừng" while the employee is working. `/` and `@` menus plug in via `extensions` (US3).

export interface ComposerProps {
  busy: boolean;
  model: string | null;
  modelInfo: ModelOption | undefined;
  modelUnavailable: boolean;
  onModelChange(modelId: string): void;
  /** Short confirmation or error shown under the picker after a model change. */
  modelNote?: { kind: 'saved' | 'error'; text: string } | null;
  onSend(parts: UserInputPart[], model: string): Promise<void>;
  onStop(): Promise<void>;
  renderExtensions?: (ctx: { text: string; setText(t: string): void; model: string | null; addPart(p: UserInputPart): void }) => React.ReactNode;
}

export function Composer({ busy, model, modelInfo, modelUnavailable, onModelChange, modelNote, onSend, onStop, renderExtensions }: ComposerProps) {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<UserInputPart[]>([]);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const qs = quotaState(modelInfo);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !model || sending || qs === 'empty' || modelUnavailable) return;
    if (qs === 'low' && !confirm('This model has less than 10% quota left. Send anyway?')) return;
    setSending(true);
    setFailed(null);
    try {
      await onSend([...mentions, { text: trimmed }], model);
      setText('');
      setMentions([]);
    } catch (err) {
      setFailed((err as { appUnavailable?: boolean }).appUnavailable ? 'The Antigravity App is not ready.' : 'Sending failed.');
    } finally {
      setSending(false);
      area.current?.focus();
    }
  }

  return (
    <div className="composer">
      {renderExtensions?.({ text, setText, model, addPart: (p) => setMentions((m) => [...m, p]) })}
      {mentions.length > 0 && (
        <div className="mentions">
          {mentions.map((p, i) =>
            'mention' in p ? (
              <span key={p.mention.uri} className="chip">
                @{p.mention.label}
                <button aria-label="Remove" onClick={() => setMentions((m) => m.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            ) : null,
          )}
        </div>
      )}
      <textarea
        ref={area}
        value={text}
        placeholder="Message the employee… (Enter to send, Shift+Enter for a new line, / for commands, @ to mention a file)"
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !e.defaultPrevented) {
            e.preventDefault();
            void send();
          }
        }}
      />
      {failed && (
        <div className="send-failed" role="alert">
          {failed}{' '}
          <button className="link" onClick={() => void send()}>
            Retry
          </button>
        </div>
      )}
      <div className="composer-bar">
        <ModelPicker value={model} unavailable={modelUnavailable} autoSelectFirst={false} onChange={(id) => onModelChange(id)} />
        {modelNote && (
          <span className={modelNote.kind === 'saved' ? 'model-saved' : 'send-failed'} role="status">
            {modelNote.text}
          </span>
        )}
        {busy ? (
          <button className="btn btn-stop" onClick={() => void onStop()}>
            ■ Stop
          </button>
        ) : null}
        <button className="btn btn-primary" disabled={!text.trim() || sending || qs === 'empty' || modelUnavailable || !model} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
