/**
 * Formato dos resultados salvos no histórico do navegador.
 * `parseResultInput` valida o que é lido de volta do localStorage.
 */

export const CONTROLS = ['keyboard', 'arrows', 'space'] as const;
export type Control = (typeof CONTROLS)[number];

export const TYPING_DURATIONS = [15, 30, 60, 120] as const;
export const ESCUTA_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type Speed = (typeof ESCUTA_SPEEDS)[number];
export const ESCUTA_MAX_ATTEMPTS = 6;

export interface TypingData {
  lpm: number;
  wpm: number;
  accuracy: number;
  letters: number;
  errors: number;
  phrases: number;
}

export interface EscutaData {
  won: boolean;
  /** Tentativas usadas (1 a 6). */
  attempts: number;
  word: string;
}

/** Digitação: depende do controle, da dica e da duração. */
export interface TypingInput {
  game: 'typing';
  control: Control;
  hint: boolean;
  duration: number;
  data: TypingData;
}

/** Escuta: a resposta é digitada no teclado comum; o que muda é a velocidade do áudio. */
export interface EscutaInput {
  game: 'escuta';
  speed: Speed;
  data: EscutaData;
}

export type ResultInput = TypingInput | EscutaInput;

export type StoredResult = ResultInput & { id: number; createdAt: number };

export type TypingResult = TypingInput & { id: number; createdAt: number };
export type EscutaResult = EscutaInput & { id: number; createdAt: number };

/** O que `saveResult` devolve ao salvar uma partida. */
export interface SaveResponse {
  result: StoredResult;
  /** Digitação: melhor LPM anterior na mesma combinação (controle + dica + duração). */
  previousBest?: number | null;
  isRecord?: boolean;
  /** Escuta: resumo de todos os jogos salvos. */
  summary?: { played: number; wins: number; streak: number };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

/** Valida um resultado salvo. Devolve null se algo estiver fora do esperado. */
export function parseResultInput(body: unknown): ResultInput | null {
  if (!isObj(body) || !isObj(body.data)) return null;
  const d = body.data;

  if (body.game === 'typing') {
    if (!CONTROLS.includes(body.control as Control)) return null;
    if (typeof body.hint !== 'boolean') return null;
    if (!TYPING_DURATIONS.includes(body.duration as (typeof TYPING_DURATIONS)[number])) return null;
    const data = {
      lpm: num(d.lpm, 0, 1000),
      wpm: num(d.wpm, 0, 300),
      accuracy: num(d.accuracy, 0, 100),
      letters: num(d.letters, 0, 10000),
      errors: num(d.errors, 0, 10000),
      phrases: num(d.phrases, 0, 1000),
    };
    if (Object.values(data).some((v) => v === null)) return null;
    return {
      game: 'typing',
      control: body.control as Control,
      hint: body.hint,
      duration: body.duration as number,
      data: data as TypingData,
    };
  }

  if (body.game === 'escuta') {
    if (!ESCUTA_SPEEDS.includes(body.speed as Speed)) return null;
    const attempts = num(d.attempts, 1, ESCUTA_MAX_ATTEMPTS);
    if (typeof d.won !== 'boolean' || attempts === null || !Number.isInteger(attempts)) return null;
    if (typeof d.word !== 'string' || !/^[A-Z]{3,10}$/.test(d.word)) return null;
    return { game: 'escuta', speed: body.speed as Speed, data: { won: d.won, attempts, word: d.word } };
  }

  return null;
}
