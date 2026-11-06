import { useEffect, useState } from 'react';
import type { ModelOption } from '@shared/domain';
import { api } from '../../api/client';

// T071 / FR-024: model per turn, with remaining quota of its group; warns < 10 %, blocks at 0 %.

let cache: Promise<ModelOption[]> | null = null;
export function loadModels(force = false): Promise<ModelOption[]> {
  if (!cache || force) cache = api<ModelOption[]>('/api/models').catch((e) => ((cache = null), Promise.reject(e)));
  return cache;
}

export function quotaState(m: ModelOption | undefined): 'ok' | 'low' | 'empty' {
  if (!m || m.remainingPercent == null) return 'ok';
  if (m.remainingPercent <= 0) return 'empty';
  return m.remainingPercent < 10 ? 'low' : 'ok';
}

export function ModelPicker({ value, onChange }: { value: string | null; onChange(modelId: string, m: ModelOption): void }) {
  const [models, setModels] = useState<ModelOption[]>([]);
  useEffect(() => {
    loadModels()
      .then((list) => {
        setModels(list);
        if (!value && list[0]) onChange(list[0].modelId, list[0]);
      })
      .catch(() => undefined);
  }, []); // eslint-disable-line

  const current = models.find((m) => m.modelId === value);
  const state = quotaState(current);
  return (
    <div className="model-picker">
      <select
        aria-label="Chọn model"
        value={value ?? ''}
        onChange={(e) => {
          const m = models.find((x) => x.modelId === e.target.value);
          if (m) onChange(m.modelId, m);
        }}
      >
        {models.map((m) => (
          <option key={m.modelId} value={m.modelId} disabled={quotaState(m) === 'empty'}>
            {m.label}
            {m.remainingPercent != null ? ` — còn ${Math.round(m.remainingPercent)}%` : ''}
          </option>
        ))}
      </select>
      {state === 'low' && <span className="quota-warn">Quota sắp hết</span>}
      {state === 'empty' && <span className="quota-empty">Hết quota — hãy chọn model khác</span>}
    </div>
  );
}
