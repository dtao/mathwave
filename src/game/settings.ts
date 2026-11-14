import { ALL_NUMBERS, type Op } from './facts';

export interface Settings {
  op: Op;
  tables: number[];
  sessionLength: number;
  muted: boolean;
  /** 0-1 */
  beatVolume: number;
  melodyVolume: number;
}

export const SESSION_LENGTHS = [10, 20, 30, 50];

export const DEFAULT_SETTINGS: Settings = {
  op: 'mul',
  tables: ALL_NUMBERS,
  sessionLength: 20,
  muted: false,
  beatVolume: 0.8,
  melodyVolume: 0.8,
};

const STORAGE_KEY = 'mathwave:settings:v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
