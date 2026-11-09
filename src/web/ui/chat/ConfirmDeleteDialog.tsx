import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';

// 004 US2 (U4-2, FR-013): confirm permanently deleting a conversation in the App — and its subagents,
// which the App deletes with it. Focus starts on "Huỷ"; Esc cancels.

const ERRORS: Record<string, string> = {
  AGENT_BUSY: 'Agent vừa bắt đầu chạy — dừng agent rồi thử lại',
  APP_UNAVAILABLE: 'Chưa kết nối được Antigravity App',
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
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(ERRORS[err instanceof ApiError ? err.code : ''] ?? 'App không xoá được conversation này');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal panel"
        role="alertdialog"
        aria-modal="true"
        aria-label="Xoá nhân viên"
        data-testid="confirm-delete"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Xoá nhân viên?</h2>
        <p>
          Conversation <strong>{name}</strong>
          {subagents > 0 && <> cùng {subagents} subagent con</>} sẽ bị <strong>xoá vĩnh viễn trong Antigravity App</strong>. Không
          hoàn tác được.
        </p>
        {error && (
          <div className="send-failed" data-testid="confirm-delete-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button ref={cancelRef} className="btn" disabled={busy} onClick={onCancel}>
            Huỷ
          </button>
          <button className="btn btn-stop" data-testid="confirm-delete-ok" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
          </button>
        </div>
      </div>
    </div>
  );
}
