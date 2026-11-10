import { useEffect, useState } from 'react';
import type { ModelOption } from '@shared/domain';
import { api } from '../../api/client';

// T071 / FR-024: model per turn, with remaining quota of its group; warns < 10 %, blocks at 0 %.
// 002 US1: the chat passes a resolved value and never lets the picker auto-select; a remembered model
// that is no longer offered stays selected and is flagged (FR-004).

let cache: Promise<ModelOption[]> | null = null;
export function loadModels(force = false): Promise<ModelOption[]> {
  if (!cache || force) cache = api<ModelOption[]>('/api/models').catch((e) => ((cache = null), Promise.reject(e)));
  return cache;
}

export function useModels(): ModelOption[] {
  const [models, setModels] = useState<ModelOption[]>([]);
  useEffect(() => {
    let alive = true;
    loadModels()
      .then((list) => alive && setModels(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return models;
}

export function quotaState(m: ModelOption | undefined): 'ok' | 'low' | 'empty' {
  if (!m || m.remainingPercent == null) return 'ok';
  if (m.remainingPercent <= 0) return 'empty';
  return m.remainingPercent < 10 ? 'low' : 'ok';
}

export interface ModelPickerProps {
  value: string | null;
  onChange(modelId: string, m: ModelOption): void;
  /** Pick the first model when there is no value (new hire dialog). Off in the chat (002 US1). */
  autoSelectFirst?: boolean;
  /** The value is remembered but no longer usable (gone or out of quota). */
  unavailable?: boolean;
}

export function ModelPicker({ value, onChange, autoSelectFirst = true, unavailable = false }: ModelPickerProps) {
  const models = useModels();
  useEffect(() => {
    if (autoSelectFirst && !value && models[0]) onChange(models[0].modelId, models[0]);
  }, [models]);

  const current = models.find((m) => m.modelId === value);
  const state = quotaState(current);
  const missing = !!value && models.length > 0 && !current;
  return (
    <div className={`model-picker ${unavailable ? 'model-picker-bad' : ''}`} data-testid="model-picker">
      <select
        aria-label="Choose model"
        value={value ?? ''}
        onChange={(e) => {
          const m = models.find((x) => x.modelId === e.target.value);
          if (m) onChange(m.modelId, m);
        }}
      >
        {missing && (
          <option value={value!} disabled>
            Previously chosen model
          </option>
        )}
        {models.map((m) => (
          <option key={m.modelId} value={m.modelId} disabled={quotaState(m) === 'empty' && m.modelId !== value}>
            {m.label}
            {m.remainingPercent != null ? ` — ${Math.round(m.remainingPercent)}% left` : ''}
          </option>
        ))}
      </select>
      {unavailable ? (
        <span className="quota-empty" role="alert" data-testid="model-unavailable">
          {current?.label ?? 'The chosen model'} is no longer available — choose another model
        </span>
      ) : (
        <>
          {state === 'low' && <span className="quota-warn">Quota almost used up</span>}
          {state === 'empty' && <span className="quota-empty">Out of quota — choose another model</span>}
        </>
      )}
    </div>
  );
}
