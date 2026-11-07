import { useEffect, useState } from 'react';
import { CITIES, type City, type DetailLevel, type ModelOption } from '@shared/domain';
import { useSettings } from '../../state/settings';
import { useWeather } from '../../state/weather';
import { loadModels } from '../chat/ModelPicker';
import { UsageStats } from './UsageStats';

// T112 + T113: city (FR-060), light/dark (FR-064), detail level + auto-lower (FR-065), default model,
// usage statistics; plus the always-visible Open-Meteo attribution (CC BY 4.0, FR-063).

export const CITY_NAMES: Record<City, string> = {
  hanoi: 'Hà Nội',
  hcmc: 'TP. Hồ Chí Minh',
  singapore: 'Singapore',
  tokyo: 'Tokyo',
  newyork: 'New York',
};
const DETAIL_NAMES: Record<DetailLevel, string> = { low: 'Thấp', medium: 'Vừa', high: 'Cao' };
const WEATHER_NAMES = { clear: 'Trời quang', cloudy: 'Nhiều mây', rain: 'Mưa', storm: 'Giông', fog_snow: 'Sương mù / tuyết' } as const;

export function ThemeToggle() {
  const theme = useSettings((s) => s.settings.theme);
  const update = useSettings((s) => s.update);
  return (
    <button className="btn" onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })} aria-label="Đổi chế độ sáng/tối">
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
      <button className="btn" onClick={() => setOpen(true)} aria-label="Cài đặt">
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
      <div className="modal panel" role="dialog" aria-label="Cài đặt" onClick={(e) => e.stopPropagation()}>
        <h3>Cài đặt</h3>
        <label>
          Thành phố
          <select aria-label="Thành phố" value={settings.city} onChange={(e) => update({ city: e.target.value as City })}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {CITY_NAMES[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giao diện
          <select aria-label="Giao diện" value={settings.theme} onChange={(e) => update({ theme: e.target.value as 'light' | 'dark' })}>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </label>
        <label>
          Mức chi tiết bối cảnh (công viên, thành phố)
          <select aria-label="Mức chi tiết" value={settings.detailLevel} onChange={(e) => update({ detailLevel: e.target.value as DetailLevel })}>
            {(['low', 'medium', 'high'] as const).map((d) => (
              <option key={d} value={d}>
                {DETAIL_NAMES[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={settings.autoLowerDetail} onChange={(e) => update({ autoLowerDetail: e.target.checked })} />
          Tự giảm chi tiết khi máy chạy chậm
        </label>
        <label>
          Model mặc định
          <select aria-label="Model mặc định" value={settings.defaultModel ?? ''} onChange={(e) => update({ defaultModel: e.target.value || null })}>
            <option value="">Theo lượt trước</option>
            {models.map((m) => (
              <option key={m.modelId} value={m.modelId}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <details>
          <summary>Thống kê sử dụng</summary>
          <UsageStats />
        </details>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
