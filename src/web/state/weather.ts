import { create } from 'zustand';
import type { WeatherSnapshot } from '@shared/domain';

interface WeatherStore {
  weather: WeatherSnapshot | null;
  set(w: WeatherSnapshot): void;
}

export const useWeather = create<WeatherStore>((set) => ({
  weather: null,
  set: (weather) => set({ weather }),
}));
