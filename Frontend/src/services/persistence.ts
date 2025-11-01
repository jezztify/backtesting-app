import { Drawing } from '../types/drawings';

const STORAGE_KEY = 'manual-backtesting-workspaces';

interface WorkspaceState {
  drawings: Drawing[];
  playbackIndex: number;
  // Persist last-used fibonacci levels so new drawings can reuse them
  lastFibonacciLevels?: number[];
  // UI chart settings
  layout?: 'single' | 'dual';
  splitPercent?: number;
}

type WorkspaceMap = Record<string, WorkspaceState>;

const readStorage = (): WorkspaceMap => {
  if (typeof window === 'undefined') {
    return {};
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as WorkspaceMap;
  } catch (error) {
    console.warn('Failed to parse workspace storage', error);
    return {};
  }
};

const writeStorage = (value: WorkspaceMap): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const loadWorkspaceState = (datasetId: string): WorkspaceState | null => {
  const storage = readStorage();
  return storage[datasetId] ?? null;
};

export const saveWorkspaceState = (datasetId: string, state: WorkspaceState): void => {
  const storage = readStorage();
  storage[datasetId] = state;
  writeStorage(storage);
};

export const clearWorkspaceState = (datasetId: string): void => {
  const storage = readStorage();
  if (storage[datasetId]) {
    delete storage[datasetId];
    writeStorage(storage);
  }
};