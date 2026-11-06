import { useRef, useState } from 'react';
import type { ModelOption, UserInputPart } from '@shared/domain';
import { ModelPicker, quotaState } from './ModelPicker';

// T070: multi-line input, Enter sends, Shift+Enter newline; keeps text and offers "Gửi lại" on failure;
// shows "Dừng" while the employee is working. `/` and `@` menus plug in via `extensions` (US3).

export interface ComposerProps {
  busy: boolean;
  defaultModel: string | null;
  onSend(parts: UserInputPart[], model: string): Promise<void>;
  onStop(): Promise<void>;
  renderExtensions?: (ctx: { text: string; setText(t: string): void; model: string | null; addPart(p: UserInputPart): void }) => React.ReactNode;
}

export function Composer({ busy, defaultModel, onSend, onStop, renderExtensions }: ComposerProps) {
  const [text, setText] = useState('');
  const [model, setModel] = useState<string | null>(defaultModel);
  const [modelInfo, setModelInfo] = useState<ModelOption | undefined>();
  const [mentions, setMentions] = useState<UserInputPart[]>([]);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const qs = quotaState(modelInfo);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !model || sending || qs === 'empty') return;
    if (qs === 'low' && !confirm('Quota của model này còn dưới 10%. Vẫn gửi?')) return;
    setSending(true);
    setFailed(null);
    try {
      await onSend([...mentions, { text: trimmed }], model);
      setText('');
      setMentions([]);
    } catch (err) {
      setFailed((err as { appUnavailable?: boolean }).appUnavailable ? 'Antigravity App chưa sẵn sàng.' : 'Gửi không thành công.');
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
                <button aria-label="Bỏ" onClick={() => setMentions((m) => m.filter((_, j) => j !== i))}>
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
        placeholder="Nhắn cho nhân viên… (Enter để gửi, Shift+Enter xuống dòng, / để gọi lệnh, @ để nhắc file)"
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
            Gửi lại
          </button>
        </div>
      )}
      <div className="composer-bar">
        <ModelPicker
          value={model}
          onChange={(id, m) => {
            setModel(id);
            setModelInfo(m);
          }}
        />
        {busy ? (
          <button className="btn btn-stop" onClick={() => void onStop()}>
            ■ Dừng
          </button>
        ) : null}
        <button className="btn btn-primary" disabled={!text.trim() || sending || qs === 'empty'} onClick={() => void send()}>
          {sending ? 'Đang gửi…' : 'Gửi'}
        </button>
      </div>
    </div>
  );
}
