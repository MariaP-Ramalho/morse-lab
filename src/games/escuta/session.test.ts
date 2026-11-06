import { describe, expect, it } from 'vitest';
import { EscutaSession, MAX_ATTEMPTS, scoreGuess } from './session';
import { WORDS, wordPicker } from './words.pt';

/** Digita uma palavra letra a letra. */
function typeWord(s: EscutaSession, word: string) {
  for (const c of word) s.type(c);
}

describe('scoreGuess', () => {
  it('marca certas, presentes e ausentes', () => {
    expect(scoreGuess('PORTA', 'PRAIA')).toEqual(['correct', 'absent', 'present', 'absent', 'correct']);
  });
  it('letras repetidas só contam quantas existem na resposta', () => {
    // PRAIA tem dois A, ambos acertados nas posições 3 e 5: o primeiro A do palpite sobra.
    expect(scoreGuess('ARARA', 'PRAIA')).toEqual(['absent', 'correct', 'correct', 'absent', 'correct']);
    // Um A em lugar errado e um certo.
    expect(scoreGuess('AMIGA', 'PRAIA')).toEqual(['present', 'absent', 'present', 'absent', 'correct']);
  });
});

describe('EscutaSession', () => {
  it('monta o palpite com letras digitadas e envia com enter', () => {
    const s = new EscutaSession('PRAIA');
    typeWord(s, 'PORTA');
    expect(s.current).toBe('PORTA');
    expect(s.enter()).toBe('submitted');
    expect(s.rows).toHaveLength(1);
    expect(s.letterStates.P).toBe('correct');
    expect(s.letterStates.O).toBe('absent');
  });

  it('ganha ao acertar a palavra', () => {
    const s = new EscutaSession('PRAIA');
    typeWord(s, 'PRAIA');
    expect(s.enter()).toBe('submitted');
    expect(s.status).toBe('won');
  });

  it('enter com palavra incompleta não envia', () => {
    const s = new EscutaSession('PRAIA');
    typeWord(s, 'PR');
    expect(s.enter()).toBe('incomplete');
    expect(s.rows).toHaveLength(0);
  });

  it('só aceita letras de A a Z', () => {
    const s = new EscutaSession('PRAIA');
    expect(s.type('1')).toBe('none');
    expect(s.type('a')).toBe('none');
    expect(s.type('AB')).toBe('none');
    expect(s.current).toBe('');
  });

  it('não passa do tamanho da palavra', () => {
    const s = new EscutaSession('PRAIA');
    typeWord(s, 'PORTA');
    expect(s.type('X')).toBe('full');
    expect(s.current).toBe('PORTA');
  });

  it('backspace apaga a última letra', () => {
    const s = new EscutaSession('PRAIA');
    typeWord(s, 'PO');
    s.backspace();
    expect(s.current).toBe('P');
  });

  it('perde depois de todas as tentativas', () => {
    const s = new EscutaSession('PRAIA');
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      typeWord(s, 'PORTA');
      s.enter();
    }
    expect(s.status).toBe('lost');
  });
});

describe('palavras', () => {
  it('todas têm 5 letras sem acento e há bastante variedade', () => {
    expect(WORDS.length).toBeGreaterThan(150);
    for (const w of WORDS) expect(w).toMatch(/^[A-Z]{5}$/);
  });
  it('o sorteio não repete palavras recentes', () => {
    const pick = wordPicker();
    const seen = new Set(Array.from({ length: 20 }, pick));
    expect(seen.size).toBe(20);
  });
});
