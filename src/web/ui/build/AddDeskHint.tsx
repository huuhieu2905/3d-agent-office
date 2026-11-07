import { useShallow } from 'zustand/react/shallow';
import { useEmployees } from '../../state/employees';
import { useBuild } from '../../state/build';
import { api } from '../../api/client';
import type { OfficeLayout } from '@shared/domain';

// T104 / US5 scenario 4: employees without a desk wait in the lobby; suggest adding desks.

export function AddDeskHint() {
  const waiting = useEmployees(useShallow((s) => Object.values(s.byId).filter((e) => e.visible && !e.deskId && !e.isSubagent).length));
  const active = useBuild((s) => s.active);
  const begin = useBuild((s) => s.begin);
  const setPalette = useBuild((s) => s.setPalette);
  if (waiting === 0 || active) return null;
  return (
    <div className="panel hint" role="status">
      {waiting} nhân viên chưa có bàn và đang đứng ở khu chờ.{' '}
      <button
        className="link"
        onClick={() =>
          api<OfficeLayout>('/api/layout')
            .then((l) => {
              begin(l);
              setPalette('desk');
            })
            .catch(() => undefined)
        }
      >
        Thêm bàn
      </button>
    </div>
  );
}
