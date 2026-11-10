import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, unitMs } from './settings';
import { parseResultInput, speedBand } from './shared/results';

const KEY = 'morse-game-settings-v2';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = fakeStorage();
});

describe('velocidade da Escuta', () => {
  it('agrupa a velocidade em faixas', () => {
    expect([5, 9, 10, 14, 15, 20, 21, 30].map(speedBand)).toEqual([
      'slow', 'slow', 'normal', 'normal', 'fast', 'fast', 'veryfast', 'veryfast',
    ]);
  });

  it('as velocidades antigas continuam na mesma faixa', () => {
    expect(speedBand(8)).toBe('slow');
    expect(speedBand(11)).toBe('normal');
    expect(speedBand(16)).toBe('fast');
  });

  it('20 ppm = unidade de 60 ms', () => {
    expect(unitMs(20)).toBe(60);
  });

  it('converte a opção antiga das configurações', () => {
    localStorage.setItem(KEY, JSON.stringify({ escutaSpeed: 'fast' }));
    const s = loadSettings();
    expect(s.escutaWpm).toBe(16);
    expect('escutaSpeed' in s).toBe(false);
  });

  it('corrige velocidade fora do intervalo', () => {
    localStorage.setItem(KEY, JSON.stringify({ escutaWpm: 99 }));
    expect(loadSettings().escutaWpm).toBe(30);
  });

  it('aceita resultado com e sem ppm, e recusa ppm inválido', () => {
    const base = { game: 'escuta', speed: 'normal', data: { won: true, attempts: 2, word: 'CASA' } };
    expect(parseResultInput(base)).not.toBeNull();
    expect(parseResultInput({ ...base, wpm: 12 })).toMatchObject({ wpm: 12 });
    expect(parseResultInput({ ...base, wpm: 3 })).toBeNull();
    expect(parseResultInput({ ...base, wpm: 12.5 })).toBeNull();
  });
});
