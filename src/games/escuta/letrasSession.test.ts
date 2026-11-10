import { describe, expect, it } from 'vitest';
import { letterPicker, LetrasSession } from './letrasSession';

/** Sorteio previsível: devolve as letras na ordem dada. */
const seq = (letters: string) => {
  let i = 0;
  return () => letters[i++ % letters.length];
};

describe('LetrasSession', () => {
  it('conta acertos, erros, precisão e letras erradas', () => {
    const s = new LetrasSession(seq('ABCD'));
    expect(s.current).toBe('A');
    expect(s.answer('A').ok).toBe(true);
    expect(s.current).toBe('B');
    expect(s.answer('X')).toEqual({ letter: 'B', typed: 'X', ok: false });
    s.answer('C');
    s.answer('E');
    expect(s.correct).toBe(2);
    expect(s.errors).toBe(2);
    expect(s.accuracy).toBe(50);
    expect(s.missed).toBe('BD');
  });

  it('precisão é 0 sem respostas', () => {
    expect(new LetrasSession(seq('A')).accuracy).toBe(0);
  });
});

describe('letterPicker', () => {
  it('não repete a letra anterior', () => {
    // Math.random falso: primeiro sorteia A de novo, depois B.
    const values = [0, 0, 1 / 26];
    let i = 0;
    const pick = letterPicker(() => values[i++]);
    const first = pick();
    expect(first).toBe('A');
    expect(pick(first)).toBe('B');
  });
});
