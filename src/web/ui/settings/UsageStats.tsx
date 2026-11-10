import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// T073 / SC-001 / SC-006: share of messages sent through the office vs. all user messages seen in the App.

interface Week {
  weekStart: string;
  sentViaOffice: number;
  userInputsTotal: number;
}

export function UsageStats() {
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  useEffect(() => {
    api<{ weeks: Week[] }>('/api/usage')
      .then((r) => setWeeks(r.weeks))
      .catch(() => setWeeks([]));
  }, []);
  if (!weeks) return <div className="muted">Loading…</div>;
  if (weeks.length === 0) return <div className="muted">No usage data yet.</div>;
  return (
    <table className="usage">
      <thead>
        <tr>
          <th>Week of</th>
          <th>Sent via the office</th>
          <th>Your total messages</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {weeks.map((w) => {
          const total = Math.max(w.userInputsTotal, w.sentViaOffice);
          const pct = total ? Math.round((w.sentViaOffice / total) * 100) : 0;
          return (
            <tr key={w.weekStart}>
              <td>{w.weekStart}</td>
              <td>{w.sentViaOffice}</td>
              <td>{total}</td>
              <td className={pct >= 70 ? 'good' : ''}>{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
