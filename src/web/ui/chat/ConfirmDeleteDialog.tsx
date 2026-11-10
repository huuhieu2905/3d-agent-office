import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';

// 004 US2 (U4-2, FR-013): confirm permanently deleting a conversation in the App — and its subagents,
// which the App deletes with it. Focus starts on "Huỷ"; Esc cancels.

const ERRORS: Record<string, string> = {
  AGENT_BUSY: 'The agent just started running — stop it and try again',
  APP_UNAVAILABLE: 'Not connected to the Antigravity App',
};

export function ConfirmDeleteDialog({
  conversationId,
  name,
  subagents,
  onCancel,
  onDeleted,
}: {
  conversationId: string;
  name: string;
  subagents: number;
  onCancel(): void;
  onDeleted(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // 006: this Esc belongs to the dialog, not to the chat behind it
      if (!busy) onCancel();
    };
    // Capture phase: runs before the chat panel's Esc listener, which was registered first.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(ERRORS[err instanceof ApiError ? err.code : ''] ?? 'The App could not delete this conversation');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal panel"
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete employee"
        data-testid="confirm-delete"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Delete employee?</h2>
        <p>
          Conversation <strong>{name}</strong>
          {subagents > 0 && <> and its {subagents} subagent(s)</>} will be <strong>permanently deleted in the Antigravity App</strong>. This
          cannot be undone.
        </p>
        {error && (
          <div className="send-failed" data-testid="confirm-delete-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button ref={cancelRef} className="btn" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-stop" data-testid="confirm-delete-ok" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
