/**
 * Formato dos resultados salvos no histórico do navegador.
 * `parseResultInput` valida o que é lido de volta do localStorage.
 */

export const CONTROLS = ['keyboard', 'arrows', 'space'] as const;
export type Control = (typeof CONTROLS)[number];

export const TYPING_DURATIONS = [15, 30, 60, 120] as const;
/** Faixas de velocidade do áudio da Escuta (recordes e filtros agrupam por faixa). */
export const ESCUTA_SPEEDS = ['slow', 'normal', 'fast', 'veryfast'] as const;
export type Speed = (typeof ESCUTA_SPEEDS)[number];
export const SPEED_NAMES: Record<Speed, string> = { slow: 'lenta', normal: 'normal', fast: 'rápida', veryfast: 'muito rápida' };

/** Velocidade do áudio em palavras por minuto (padrão "PARIS": 1 unidade = 1200 / ppm ms). */
export const WPM_MIN = 5;
export const WPM_MAX = 30;

/** Faixa de uma velocidade: lenta 5–9, normal 10–14, rápida 15–20, muito rápida 21–30 ppm. */
export function speedBand(wpm: number): Speed {
  if (wpm < 10) return 'slow';
  if (wpm < 15) return 'normal';
  if (wpm <= 20) return 'fast';
  return 'veryfast';
}

/** Ex.: "normal · 12 ppm" (resultados antigos não têm ppm). */
export const speedLabel = (r: { speed: Speed; wpm?: number }) => (r.wpm ? `${SPEED_NAMES[r.speed]} · ${r.wpm} ppm` : SPEED_NAMES[r.speed]);
export const ESCUTA_MAX_ATTEMPTS = 6;
/** Durações do modo "letra a letra" da Escuta (s). */
export const LETRAS_DURATIONS = [30, 60, 120] as const;

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

export interface LetrasData {
  /** Letras acertadas. */
  correct: number;
  errors: number;
  /** Porcentagem de acertos (0 a 100). */
  accuracy: number;
  /** Letras que tocaram e foram respondidas errado, na ordem (ex.: "QYQ"). */
  missed: string;
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
  /** Velocidade exata em palavras por minuto (ausente nos resultados antigos). */
  wpm?: number;
  data: EscutaData;
}

/** Escuta, modo letra a letra: depende da velocidade, da duração, da dica e das letras escolhidas. */
export interface LetrasInput {
  game: 'letras';
  speed: Speed;
  /** Velocidade exata em palavras por minuto. */
  wpm?: number;
  duration: number;
  hint: boolean;
  /** Letras sorteadas, em ordem alfabética, quando a pessoa escolheu só algumas (ausente = alfabeto todo). */
  letters?: string;
  data: LetrasData;
}

/** Mesmo conjunto de letras (rodadas com letras diferentes não se comparam). */
export const sameLetters = (a: { letters?: string }, b: { letters?: string }) => (a.letters ?? '') === (b.letters ?? '');

export type ResultInput = TypingInput | EscutaInput | LetrasInput;

export type StoredResult = ResultInput & { id: number; createdAt: number };

export type TypingResult = TypingInput & { id: number; createdAt: number };
export type EscutaResult = EscutaInput & { id: number; createdAt: number };
export type LetrasResult = LetrasInput & { id: number; createdAt: number };

/** O que `saveResult` devolve ao salvar uma partida. */
export interface SaveResponse {
  result: StoredResult;
  /**
   * Melhor marca anterior na mesma combinação: LPM na Digitação (controle + dica + duração),
   * acertos no letra a letra (velocidade + duração + dica + letras).
   */
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
  // ppm é opcional (resultados antigos não têm); se vier, precisa ser um inteiro válido.
  let wpm: { wpm?: number } = {};
  if (body.wpm !== undefined) {
    const w = num(body.wpm, WPM_MIN, WPM_MAX);
    if (w === null || !Number.isInteger(w)) return null;
    wpm = { wpm: w };
  }

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
    return { game: 'escuta', speed: body.speed as Speed, ...wpm, data: { won: d.won, attempts, word: d.word } };
  }

  if (body.game === 'letras') {
    if (!ESCUTA_SPEEDS.includes(body.speed as Speed)) return null;
    if (!LETRAS_DURATIONS.includes(body.duration as (typeof LETRAS_DURATIONS)[number])) return null;
    if (typeof body.hint !== 'boolean') return null;
    const correct = num(d.correct, 0, 10000);
    const errors = num(d.errors, 0, 10000);
    const accuracy = num(d.accuracy, 0, 100);
    if (correct === null || errors === null || accuracy === null) return null;
    if (typeof d.missed !== 'string' || !/^[A-Z]{0,2000}$/.test(d.missed)) return null;
    let letters: { letters?: string } = {};
    if (body.letters !== undefined) {
      if (typeof body.letters !== 'string' || !/^[A-Z]{2,25}$/.test(body.letters)) return null;
      letters = { letters: body.letters };
    }
    return {
      game: 'letras',
      speed: body.speed as Speed,
      ...wpm,
      duration: body.duration as number,
      hint: body.hint,
      ...letters,
      data: { correct, errors, accuracy, missed: d.missed },
    };
  }

  return null;
}
