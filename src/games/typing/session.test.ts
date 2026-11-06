import { describe, expect, it } from 'vitest';
import { MORSE } from '../../morse/alphabet';
import { normalize } from '../../morse/normalize';
import type { MorseSymbol } from '../../input/types';
import { computeResults, phrasePicker, TypingSession } from './session';

const type = (s: TypingSession, code: string) =>
  code.split('').map((c) => s.input((c === '.' ? 'dot' : 'dash') as MorseSymbol));

describe('normalize', () => {
  it('remove acentos e põe em maiúsculas', () => {
    expect(normalize('Coração não é fácil')).toBe('CORACAO NAO E FACIL');
  });
  it('remove caracteres sem Morse e espaços extras', () => {
    expect(normalize('  oi;  tudo  bem?  ')).toBe('OI TUDO BEM?');
    expect(normalize('Praça')).toBe('PRACA'); // nos jogos, ç continua valendo como C
  });
});

describe('alphabet', () => {
  it('tem todas as letras e números', () => {
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') expect(MORSE[c]).toBeTruthy();
  });
  it('não tem códigos repetidos', () => {
    const codes = Object.values(MORSE);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('TypingSession', () => {
  it('avança automaticamente quando o código bate', () => {
    const s = new TypingSession(() => 'SOS');
    expect(type(s, '..').map((r) => r.kind)).toEqual(['progress', 'progress']);
    expect(s.input('dot').kind).toBe('letter');
    expect(s.index).toBe(1);
  });

  it('E (.) avança com um só ponto mas I (..) espera', () => {
    const s = new TypingSession(() => 'EI');
    expect(s.input('dot').kind).toBe('letter');
    expect(s.input('dot').kind).toBe('progress');
    expect(s.input('dot').kind).toBe('phrase');
  });

  it('símbolo errado conta erro, limpa o buffer e fica na mesma letra', () => {
    const s = new TypingSession(() => 'AB');
    s.input('dot');
    expect(s.input('dot').kind).toBe('error'); // A é .-
    expect(s.buffer).toBe('');
    expect(s.index).toBe(0);
    expect(s.errorPositions.has(0)).toBe(true);
    type(s, '.-');
    expect(s.index).toBe(1);
    expect(s.stats.errors).toBe(1);
  });

  it('backspace apaga o último símbolo da letra atual', () => {
    const s = new TypingSession(() => 'S');
    type(s, '..');
    expect(s.backspace()).toBe(true);
    expect(s.buffer).toBe('.');
    s.backspace();
    expect(s.backspace()).toBe(false);
    type(s, '...');
    expect(s.stats.phrases).toBe(1);
  });

  it('pula espaços entre palavras', () => {
    const s = new TypingSession(() => 'e e');
    s.input('dot');
    expect(s.index).toBe(2);
    expect(s.stats.chars).toBe(2);
  });

  it('carrega nova frase ao terminar', () => {
    let n = 0;
    const s = new TypingSession(() => (n++ === 0 ? 'T' : 'E'));
    expect(s.input('dash').kind).toBe('phrase');
    expect(s.phrase).toBe('E');
    expect(s.stats.phrases).toBe(1);
  });
});

describe('computeResults', () => {
  it('calcula lpm, wpm e precisão', () => {
    const r = computeResults({ letters: 30, chars: 40, symbols: 100, errors: 10, phrases: 2 }, 60000);
    expect(r.lpm).toBe(30);
    expect(r.wpm).toBe(8);
    expect(r.accuracy).toBe(90);
  });
});

describe('phrasePicker', () => {
  it('não repete a frase anterior', () => {
    const pick = phrasePicker(['a', 'b', 'c']);
    let last = pick();
    for (let i = 0; i < 50; i++) {
      const next = pick();
      expect(next).not.toBe(last);
      last = next;
    }
  });
});
