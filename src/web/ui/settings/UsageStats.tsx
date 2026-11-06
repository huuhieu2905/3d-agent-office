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
  if (!weeks) return <div className="muted">Đang tải…</div>;
  if (weeks.length === 0) return <div className="muted">Chưa có dữ liệu sử dụng.</div>;
  return (
    <table className="usage">
      <thead>
        <tr>
          <th>Tuần bắt đầu</th>
          <th>Gửi qua văn phòng</th>
          <th>Tổng tin của sếp</th>
          <th>Tỷ lệ</th>
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
