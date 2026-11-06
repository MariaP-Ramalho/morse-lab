import { beforeEach, describe, expect, it } from 'vitest';
import type { EscutaInput, TypingInput } from '../shared/results';
import { loadResults, saveResult } from './history';

/** localStorage em memória (os testes rodam no Node). */
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const typing = (lpm: number, extra: Partial<TypingInput> = {}): TypingInput => ({
  game: 'typing',
  control: 'keyboard',
  hint: false,
  duration: 30,
  data: { lpm, wpm: 1, accuracy: 90, letters: 10, errors: 1, phrases: 0 },
  ...extra,
});

const escuta = (won: boolean): EscutaInput => ({
  game: 'escuta',
  speed: 'normal',
  data: { won, attempts: 3, word: 'CASA' },
});

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage();
});

describe('histórico no navegador', () => {
  it('detecta recorde só na mesma combinação de controle, dica e duração', () => {
    expect(saveResult(typing(40))).toMatchObject({ isRecord: true, previousBest: null, stored: true });
    expect(saveResult(typing(30))).toMatchObject({ isRecord: false, previousBest: 40 });
    expect(saveResult(typing(20, { hint: true })).isRecord).toBe(true);
    expect(saveResult(typing(25, { duration: 60 })).isRecord).toBe(true);
    expect(saveResult(typing(50))).toMatchObject({ isRecord: true, previousBest: 40 });
    expect(loadResults('typing')).toHaveLength(5);
  });

  it('conta jogos, vitórias e a sequência atual da Escuta', () => {
    saveResult(escuta(true));
    saveResult(escuta(false));
    saveResult(escuta(true));
    expect(saveResult(escuta(true)).summary).toEqual({ played: 4, wins: 3, streak: 2 });
    expect(loadResults('escuta')).toHaveLength(4);
    expect(loadResults('typing')).toHaveLength(0);
  });

  it('ignora dados corrompidos em vez de quebrar', () => {
    localStorage.setItem('morse-results', '{nao é json');
    expect(loadResults()).toEqual([]);
    localStorage.setItem('morse-results', JSON.stringify([{ game: 'typing' }, 42]));
    expect(loadResults()).toEqual([]);
  });

  it('continua funcionando quando o navegador não deixa gravar', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('cheio');
      },
    };
    expect(saveResult(typing(40))).toMatchObject({ stored: false, isRecord: true });
  });
});
