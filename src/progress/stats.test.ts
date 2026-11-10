import { describe, expect, it } from 'vitest';
import type { Control, EscutaResult, LetrasResult, TypingResult } from '../shared/results';
import {
  attemptsDistribution,
  bySpeed,
  escutaSummary,
  filterLetras,
  filterTyping,
  letrasSummary,
  missedRanking,
  recordsGrid,
  runningBest,
  typingSummary,
} from './stats';

let id = 0;
const t = (lpm: number, control: Control = 'keyboard', hint = false, duration = 30): TypingResult => ({
  id: ++id,
  createdAt: id,
  game: 'typing',
  control,
  hint,
  duration,
  data: { lpm, wpm: lpm / 5, accuracy: 80, letters: 10, errors: 2, phrases: 0 },
});
const e = (won: boolean, attempts = 4, speed: EscutaResult['speed'] = 'normal'): EscutaResult => ({
  id: ++id,
  createdAt: id,
  game: 'escuta',
  speed,
  data: { won, attempts, word: 'PRAIA' },
});

describe('digitação', () => {
  const rs = [t(40), t(55, 'space'), t(30, 'keyboard', true), t(60, 'keyboard', false, 60)];

  it('filtra por controle, dica e duração', () => {
    expect(filterTyping(rs, { control: 'keyboard', hint: 'all', duration: 'all' })).toHaveLength(3);
    expect(filterTyping(rs, { control: 'all', hint: 'on', duration: 'all' })).toHaveLength(1);
    expect(filterTyping(rs, { control: 'all', hint: 'off', duration: 30 })).toHaveLength(2);
  });

  it('resume rodadas e acha o recorde', () => {
    const s = typingSummary(rs);
    expect(s.rounds).toBe(4);
    expect(s.best?.data.lpm).toBe(60);
    expect(s.totalSeconds).toBe(150);
    expect(typingSummary([]).best).toBeNull();
  });

  it('separa os recordes por controle e dica', () => {
    const grid = recordsGrid(rs);
    expect(grid).toHaveLength(6);
    expect(grid.find((c) => c.control === 'keyboard' && !c.hint)?.bestLpm).toBe(60);
    expect(grid.find((c) => c.control === 'keyboard' && c.hint)?.bestLpm).toBe(30);
    expect(grid.find((c) => c.control === 'arrows' && !c.hint)).toMatchObject({ rounds: 0, bestLpm: null });
  });

  it('linha de recorde só sobe', () => {
    expect(runningBest([3, 5, 4, 8, 2])).toEqual([3, 5, 5, 8, 8]);
  });
});

describe('escuta', () => {
  it('calcula vitórias e sequências', () => {
    const s = escutaSummary([e(true), e(true), e(false), e(true), e(true), e(true)]);
    expect(s).toMatchObject({ played: 6, wins: 5, winRate: 83, streak: 3, bestStreak: 3, avgAttempts: 4 });
  });

  it('distribui vitórias por tentativas e conta derrotas', () => {
    const d = attemptsDistribution([e(true, 2), e(true, 2), e(true, 6), e(false, 6)]);
    expect(d.map((x) => x.value)).toEqual([0, 2, 0, 0, 0, 1, 1]);
    expect(d[6].label).toBe('perdeu');
  });

  it('separa por velocidade', () => {
    const s = bySpeed([e(true, 3, 'fast'), e(false, 6, 'fast'), e(true, 2, 'slow')]);
    expect(s.find((x) => x.speed === 'fast')?.summary.winRate).toBe(50);
    expect(s.find((x) => x.speed === 'normal')?.summary.played).toBe(0);
  });
});

describe('letra a letra', () => {
  const r = (correct: number, missed: string, extra: Partial<LetrasResult> = {}): LetrasResult => ({
    id: 1,
    createdAt: 1,
    game: 'letras',
    speed: 'normal',
    duration: 60,
    hint: false,
    data: { correct, errors: missed.length, accuracy: 50, missed },
    ...extra,
  });

  it('ordena as letras mais erradas', () => {
    expect(missedRanking([r(5, 'QYQ'), r(3, 'YQB')])).toEqual([
      { letter: 'Q', count: 3 },
      { letter: 'Y', count: 2 },
      { letter: 'B', count: 1 },
    ]);
  });

  it('filtra por velocidade, duração e dica e resume', () => {
    const rs = [r(5, ''), r(9, '', { speed: 'fast' }), r(7, '', { hint: true })];
    expect(filterLetras(rs, { speed: 'normal', duration: 60, hint: 'off' })).toHaveLength(1);
    const s = letrasSummary(rs);
    expect(s.best?.data.correct).toBe(9);
    expect(s.totalCorrect).toBe(21);
  });
});
