import type { ControlMode } from './input/types';
import { WPM_MAX, WPM_MIN } from './shared/results';

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
  /** Velocidade do áudio da Escuta em palavras por minuto (vale para os dois modos). */
  escutaWpm: number;
  /** Escuta, modo letra a letra: duração da rodada (s). */
  letrasDuration: number;
  /** Escuta, modo letra a letra: mostrar o código Morse nas teclas. */
  letrasHint: boolean;
}

/** Duração de uma unidade Morse (ms) numa velocidade em palavras por minuto. */
export const unitMs = (wpm: number) => 1200 / wpm;

/** Velocidades das antigas opções lenta / normal / rápida, para quem já tinha escolhido uma. */
const OLD_SPEED_WPM: Record<string, number> = { slow: 8, normal: 11, fast: 16 };

const KEY = 'morse-game-settings-v2';

export const DEFAULT_SETTINGS: Settings = {
  control: 'keyboard',
  spaceThresholdMs: 200,
  sound: true,
  showHint: false,
  duration: 30,
  letterGapMs: 600,
  escutaWpm: 11,
  letrasDuration: 60,
  letrasHint: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const s: Settings = { ...DEFAULT_SETTINGS, ...saved };
      if (saved.escutaWpm === undefined && saved.escutaSpeed in OLD_SPEED_WPM) s.escutaWpm = OLD_SPEED_WPM[saved.escutaSpeed];
      delete (s as Partial<Record<'escutaSpeed', unknown>>).escutaSpeed;
      s.escutaWpm = Math.round(Math.min(WPM_MAX, Math.max(WPM_MIN, Number(s.escutaWpm) || DEFAULT_SETTINGS.escutaWpm)));
      return s;
    }
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
