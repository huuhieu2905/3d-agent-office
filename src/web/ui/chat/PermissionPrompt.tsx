import { useState } from 'react';
import type { Step } from '@shared/domain';
import { api } from '../../api/client';

// T087 / FR-029: approve or deny the agent's pending request right inside the chat.

export function PermissionPrompt({ conversationId, step }: { conversationId: string; step: Step }) {
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!step.permission) return null;

  async function answer(decision: 'allow' | 'deny') {
    setBusy(decision);
    setError(null);
    try {
      await api(`/api/conversations/${conversationId}/permissions/${encodeURIComponent(step.permission!.requestId)}`, {
        method: 'POST',
        json: { decision },
      });
    } catch {
      setError('Không gửi được câu trả lời. Hãy thử lại hoặc trả lời trong Antigravity App.');
      setBusy(null);
    }
  }

  return (
    <div className="permission panel" role="alertdialog" aria-label="Agent xin quyền">
      <div className="permission-title">✋ Nhân viên xin phép</div>
      <div className="permission-body">{step.permission.description}</div>
      {step.command?.commandLine && <pre className="code">{step.command.commandLine}</pre>}
      {error && <div className="send-failed">{error}</div>}
      <div className="modal-actions">
        <button className="btn" disabled={!!busy} onClick={() => void answer('deny')}>
          {busy === 'deny' ? 'Đang gửi…' : 'Từ chối'}
        </button>
        <button className="btn btn-primary" disabled={!!busy} onClick={() => void answer('allow')}>
          {busy === 'allow' ? 'Đang gửi…' : 'Cho phép'}
        </button>
      </div>
    </div>
  );
}
