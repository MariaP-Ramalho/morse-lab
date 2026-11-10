import {
  CONTROLS,
  ESCUTA_MAX_ATTEMPTS,
  ESCUTA_SPEEDS,
  type Control,
  type EscutaResult,
  type LetrasResult,
  type Speed,
  type StoredResult,
  type TypingResult,
} from '../shared/results';

export interface TypingFilter {
  control: Control | 'all';
  hint: 'all' | 'on' | 'off';
  duration: number | 'all';
}

export const typingOnly = (rs: StoredResult[]) => rs.filter((r): r is TypingResult => r.game === 'typing');
export const escutaOnly = (rs: StoredResult[]) => rs.filter((r): r is EscutaResult => r.game === 'escuta');
export const letrasOnly = (rs: StoredResult[]) => rs.filter((r): r is LetrasResult => r.game === 'letras');

export function filterTyping(rs: TypingResult[], f: TypingFilter): TypingResult[] {
  return rs.filter(
    (r) =>
      (f.control === 'all' || r.control === f.control) &&
      (f.hint === 'all' || r.hint === (f.hint === 'on')) &&
      (f.duration === 'all' || r.duration === f.duration),
  );
}

export interface TypingSummary {
  rounds: number;
  /** Rodada com o maior LPM (null sem rodadas). */
  best: TypingResult | null;
  bestWpm: number;
  avgLpm: number;
  avgAccuracy: number;
  totalLetters: number;
  totalSeconds: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function typingSummary(rs: TypingResult[]): TypingSummary {
  let best: TypingResult | null = null;
  for (const r of rs) if (!best || r.data.lpm > best.data.lpm) best = r;
  return {
    rounds: rs.length,
    best,
    bestWpm: Math.max(0, ...rs.map((r) => r.data.wpm)),
    avgLpm: Math.round(avg(rs.map((r) => r.data.lpm))),
    avgAccuracy: Math.round(avg(rs.map((r) => r.data.accuracy))),
    totalLetters: rs.reduce((a, r) => a + r.data.letters, 0),
    totalSeconds: rs.reduce((a, r) => a + r.duration, 0),
  };
}

export interface RecordCell {
  control: Control;
  hint: boolean;
  rounds: number;
  bestLpm: number | null;
  avgAccuracy: number | null;
}

/** Recorde de LPM em cada combinação de controle e dica. */
export function recordsGrid(rs: TypingResult[]): RecordCell[] {
  const cells: RecordCell[] = [];
  for (const control of CONTROLS) {
    for (const hint of [false, true]) {
      const mine = rs.filter((r) => r.control === control && r.hint === hint);
      cells.push({
        control,
        hint,
        rounds: mine.length,
        bestLpm: mine.length ? Math.max(...mine.map((r) => r.data.lpm)) : null,
        avgAccuracy: mine.length ? Math.round(avg(mine.map((r) => r.data.accuracy))) : null,
      });
    }
  }
  return cells;
}

/** Melhor marca até cada rodada (para desenhar a linha de recorde). */
export function runningBest(values: number[]): number[] {
  let best = -Infinity;
  return values.map((v) => (best = Math.max(best, v)));
}

// ---------------- escuta ----------------

export const filterEscuta = (rs: EscutaResult[], speed: Speed | 'all') =>
  rs.filter((r) => speed === 'all' || r.speed === speed);

export interface EscutaSummary {
  played: number;
  wins: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  /** Média de tentativas nas vitórias. */
  avgAttempts: number;
}

export function escutaSummary(rs: EscutaResult[]): EscutaSummary {
  let run = 0;
  let bestStreak = 0;
  for (const r of rs) {
    run = r.data.won ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  const won = rs.filter((r) => r.data.won);
  return {
    played: rs.length,
    wins: won.length,
    winRate: rs.length ? Math.round((won.length / rs.length) * 100) : 0,
    streak: run,
    bestStreak,
    avgAttempts: Math.round(avg(won.map((r) => r.data.attempts)) * 10) / 10,
  };
}

/** Vitórias por número de tentativas (1 a 6) e derrotas. */
export function attemptsDistribution(rs: EscutaResult[]): { label: string; value: number }[] {
  const out = Array.from({ length: ESCUTA_MAX_ATTEMPTS }, (_, i) => ({ label: String(i + 1), value: 0 }));
  let lost = 0;
  for (const r of rs) {
    if (r.data.won) out[r.data.attempts - 1].value++;
    else lost++;
  }
  return [...out, { label: 'perdeu', value: lost }];
}

export function bySpeed(rs: EscutaResult[]): { speed: Speed; summary: EscutaSummary }[] {
  return ESCUTA_SPEEDS.map((speed) => ({ speed, summary: escutaSummary(filterEscuta(rs, speed)) }));
}

// ---------------- escuta: letra a letra ----------------

export interface LetrasFilter {
  speed: Speed | 'all';
  duration: number | 'all';
  hint: 'all' | 'on' | 'off';
  /** Alfabeto todo (`full`), só rodadas com letras escolhidas (`custom`) ou tudo. */
  letters?: 'all' | 'full' | 'custom';
}

export function filterLetras(rs: LetrasResult[], f: LetrasFilter): LetrasResult[] {
  return rs.filter(
    (r) =>
      (f.speed === 'all' || r.speed === f.speed) &&
      (f.duration === 'all' || r.duration === f.duration) &&
      (f.hint === 'all' || r.hint === (f.hint === 'on')) &&
      (!f.letters || f.letters === 'all' || (f.letters === 'custom') === !!r.letters),
  );
}

export interface LetrasSummary {
  rounds: number;
  /** Rodada com mais acertos (null sem rodadas). */
  best: LetrasResult | null;
  avgAccuracy: number;
  totalCorrect: number;
  totalSeconds: number;
}

export function letrasSummary(rs: LetrasResult[]): LetrasSummary {
  let best: LetrasResult | null = null;
  for (const r of rs) if (!best || r.data.correct > best.data.correct) best = r;
  return {
    rounds: rs.length,
    best,
    avgAccuracy: Math.round(avg(rs.map((r) => r.data.accuracy))),
    totalCorrect: rs.reduce((a, r) => a + r.data.correct, 0),
    totalSeconds: rs.reduce((a, r) => a + r.duration, 0),
  };
}

/** Letras mais erradas, da que mais aparece para a que menos aparece. */
export function missedRanking(rs: LetrasResult[]): { letter: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rs) for (const c of r.data.missed) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts]
    .map(([letter, count]) => ({ letter, count }))
    .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter));
}
