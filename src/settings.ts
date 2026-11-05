import type { ControlMode } from './input/types';

export interface Settings {
  control: ControlMode;
  /** Limite ponto/traço no modo barra de espaço (ms). */
  spaceThresholdMs: number;
  sound: boolean;
  /** Mostrar o código esperado da letra atual. */
  showHint: boolean;
  /** Duração do modo digitação (s). */
  duration: number;
  /** Tradutor, modo barra de espaço: pausa que fecha uma letra (ms). */
  letterGapMs: number;
}

const KEY = 'morse-game-settings-v2';

export const DEFAULT_SETTINGS: Settings = {
  control: 'keyboard',
  spaceThresholdMs: 200,
  sound: true,
  showHint: false,
  duration: 30,
  letterGapMs: 600,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* sem storage: usa o padrão */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignora */
  }
}
