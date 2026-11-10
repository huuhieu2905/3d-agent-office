import { useEffect } from 'react';
import type { Quota } from '@shared/domain';
import { api } from '../../api/client';
import { useConnection } from '../../state/connection';
import { useQuota } from '../../state/quota';

// T092 / FR-041: plan, each model group (models, % left, reset time), credits, last update.
// Also a small toolbar button as a fallback when the layout has no wall screen.

function relative(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'refreshed';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.round(h / 24)} days left`;
  return h > 0 ? `${h} h ${m} min left` : `${m} min left`;
}

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'));

export function QuotaButton() {
  const quota = useQuota((s) => s.quota);
  const setOpen = useQuota((s) => s.setPanelOpen);
  const low = quota?.groups.some((g) => g.low);
  return (
    <button className={`btn ${low ? 'btn-warn' : ''}`} onClick={() => setOpen(true)} title="Account quota">
      {low ? '⚠ ' : ''}Quota
    </button>
  );
}

export function QuotaPanel() {
  const { quota, panelOpen, setPanelOpen, set } = useQuota();
  const connected = useConnection((s) => s.app.kind === 'connected');
  useEffect(() => {
    if (connected && !quota) api<Quota>('/api/quota').then(set).catch(() => undefined);
  }, [connected, quota, set]);
  if (!panelOpen) return null;
  return (
    <div className="modal-backdrop" onClick={() => setPanelOpen(false)}>
      <div className="modal panel quota-panel" role="dialog" aria-label="Account quota" onClick={(e) => e.stopPropagation()}>
        <h3>Account quota</h3>
        {!quota ? (
          <div className="muted">No quota data yet (is the Antigravity App connected?).</div>
        ) : (
          <>
            <div>
              Plan: <strong>{quota.planName}</strong>
            </div>
            <table className="usage">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Remaining</th>
                  <th>Refresh</th>
                </tr>
              </thead>
              <tbody>
                {quota.groups.map((g) => (
                  <tr key={g.key} className={g.low ? 'low' : ''}>
                    <td>
                      {g.models.map((m) => (
                        <div key={m.modelId}>{m.label}</div>
                      ))}
                    </td>
                    <td>
                      <div className="bar">
                        <span style={{ width: `${Math.max(0, Math.min(100, g.remainingPercent))}%` }} />
                      </div>
                      {Math.round(g.remainingPercent)}%{g.low ? ' ⚠' : ''}
                    </td>
                    <td title={g.resetAt ?? ''}>
                      {g.resetAt ? new Date(g.resetAt).toLocaleString('en-US') : '—'}
                      <div className="muted small">{relative(g.resetAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="credits">
              Credits — prompt: {fmt(quota.credits.prompt.available)} / {fmt(quota.credits.prompt.monthly)} per month · flow:{' '}
              {fmt(quota.credits.flow.available)} / {fmt(quota.credits.flow.monthly)} per month
            </div>
            <div className="muted small">Updated at {new Date(quota.fetchedAt).toLocaleTimeString('en-US')}</div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={() => setPanelOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
