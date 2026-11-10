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
      setError('Could not send the answer. Try again or answer in the Antigravity App.');
      setBusy(null);
    }
  }

  return (
    <div className="permission panel" role="alertdialog" aria-label="The agent asks for permission">
      <div className="permission-title">✋ The employee asks for permission</div>
      <div className="permission-body">{step.permission.description}</div>
      {step.command?.commandLine && <pre className="code">{step.command.commandLine}</pre>}
      {error && <div className="send-failed">{error}</div>}
      <div className="modal-actions">
        <button className="btn" disabled={!!busy} onClick={() => void answer('deny')}>
          {busy === 'deny' ? 'Sending…' : 'Deny'}
        </button>
        <button className="btn btn-primary" disabled={!!busy} onClick={() => void answer('allow')}>
          {busy === 'allow' ? 'Sending…' : 'Allow'}
        </button>
      </div>
    </div>
  );
}
