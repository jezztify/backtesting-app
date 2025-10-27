import { create } from 'zustand';


export interface CanvasSettings {
  background: string;
  upBorder: string;
  upFill: string;
  upWick: string;
  downBorder: string;
  downFill: string;
  downWick: string;
}

const defaultCanvasSettings: CanvasSettings = {
  background: '#ffffff',
  upBorder: '#16a34a',
  upFill: '#b9fbc0',
  upWick: '#16a34a',
  downBorder: '#ef4444',
  downFill: '#fecaca',
  downWick: '#ef4444',
};

interface CanvasStore {
  settings: CanvasSettings;
  setSettings: (settings: Partial<CanvasSettings>) => void;
  resetSettings: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  settings: defaultCanvasSettings,
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  resetSettings: () => set({ settings: defaultCanvasSettings }),
}));