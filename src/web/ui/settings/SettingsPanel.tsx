import { useEffect, useState } from 'react';
import { CITIES, type City, type DetailLevel, type ModelOption } from '@shared/domain';
import { useSettings } from '../../state/settings';
import { useWeather } from '../../state/weather';
import { loadModels } from '../chat/ModelPicker';
import { UsageStats } from './UsageStats';

// T112 + T113: city (FR-060), light/dark (FR-064), detail level + auto-lower (FR-065), default model,
// usage statistics; plus the always-visible Open-Meteo attribution (CC BY 4.0, FR-063).

export const CITY_NAMES: Record<City, string> = {
  hanoi: 'Hanoi',
  hcmc: 'Ho Chi Minh City',
  singapore: 'Singapore',
  tokyo: 'Tokyo',
  newyork: 'New York',
};
const DETAIL_NAMES: Record<DetailLevel, string> = { low: 'Low', medium: 'Medium', high: 'High' };
const WEATHER_NAMES = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', storm: 'Storm', fog_snow: 'Fog / snow' } as const;

export function ThemeToggle() {
  const theme = useSettings((s) => s.settings.theme);
  const update = useSettings((s) => s.update);
  return (
    <button className="btn" onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Toggle light/dark mode">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

export function WeatherBadge() {
  const w = useWeather((s) => s.weather);
  const city = useSettings((s) => s.settings.city);
  return (
    <div className="weather-badge panel">
      <span>
        {CITY_NAMES[city]}
        {w && w.city === city ? ` · ${WEATHER_NAMES[w.condition]}${w.temperatureC != null ? ` · ${Math.round(w.temperatureC)}°C` : ''}` : ''}
      </span>
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener" className="attribution">
        Weather data by Open-Meteo.com
      </a>
    </div>
  );
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)} aria-label="Settings">
        ⚙︎
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function SettingsPanel({ onClose }: { onClose(): void }) {
  const { settings, update } = useSettings();
  const [models, setModels] = useState<ModelOption[]>([]);
  useEffect(() => {
    loadModels()
      .then(setModels)
      .catch(() => undefined);
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>
        <label>
          City
          <select aria-label="City" value={settings.city} onChange={(e) => update({ city: e.target.value as City })}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {CITY_NAMES[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Theme
          <select aria-label="Theme" value={settings.theme} onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Surroundings detail (park, city)
          <select aria-label="Detail level" value={settings.detailLevel} onChange={(e) => update({ detailLevel: e.target.value as DetailLevel })}>
            {(['low', 'medium', 'high'] as const).map((d) => (
              <option key={d} value={d}>
                {DETAIL_NAMES[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.autoLowerDetail} onChange={(e) => update({ autoLowerDetail: e.target.checked })} />
          Lower detail automatically when the computer is slow
        </label>
        <label>
          Default model
          <select aria-label="Default model" value={settings.defaultModel ?? ''} onChange={(e) => update({ defaultModel: e.target.value || null })}>
            <option value="">Same as last turn</option>
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mouse sensitivity <span className="muted small">{(settings.mouseSensitivity ?? 1).toFixed(2)}×</span>
          <span className="sensitivity">
            <input
              type="range"
              data-testid="mouse-sensitivity"
              aria-label="Mouse sensitivity"
              min={0.25}
              max={3}
              step={0.05}
              value={settings.mouseSensitivity ?? 1}
              onChange={(e) => update({ mouseSensitivity: Number(e.target.value) })}
            />
            <button className="btn" data-testid="mouse-sensitivity-reset" onClick={() => update({ mouseSensitivity: 1 })}>
              Reset
            </button>
          </span>
        </label>
        <details>
          <summary>Usage statistics</summary>
          <UsageStats />
        </details>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
