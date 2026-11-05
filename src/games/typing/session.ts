import { MORSE } from '../../morse/alphabet';
import { normalize } from '../../morse/normalize';
import type { MorseSymbol } from '../../input/types';

export type InputResult =
  /** Símbolo certo, mas a letra ainda não terminou. */
  | { kind: 'progress' }
  /** Letra completada. */
  | { kind: 'letter' }
  /** Letra completada e era a última da frase; uma nova frase foi carregada. */
  | { kind: 'phrase' }
  /** Símbolo errado: buffer limpo, continua na mesma letra. */
  | { kind: 'error' };

export interface SessionStats {
  /** Letras (sem espaços) completadas. */
  letters: number;
  /** Caracteres completados, incluindo espaços (base do WPM). */
  chars: number;
  /** Símbolos digitados no total. */
  symbols: number;
  /** Símbolos errados. */
  errors: number;
  /** Frases completas. */
  phrases: number;
}

/**
 * Lógica pura do modo digitação. Avança automaticamente:
 * como a letra esperada é conhecida, a letra fecha assim que o código bate.
 */
export class TypingSession {
  phrase = '';
  /** Posição da letra atual na frase. */
  index = 0;
  /** Símbolos digitados para a letra atual ('.' e '-'). */
  buffer = '';
  /** Posições da frase atual que tiveram erro. */
  errorPositions = new Set<number>();
  stats: SessionStats = { letters: 0, chars: 0, symbols: 0, errors: 0, phrases: 0 };

  constructor(private nextPhrase: () => string) {
    this.loadPhrase();
  }

  get currentChar(): string {
    return this.phrase[this.index] ?? '';
  }

  get expectedCode(): string {
    return MORSE[this.currentChar] ?? '';
  }

  input(sym: MorseSymbol): InputResult {
    const candidate = this.buffer + (sym === 'dot' ? '.' : '-');
    const expected = this.expectedCode;
    this.stats.symbols++;

    if (!expected.startsWith(candidate)) {
      this.stats.errors++;
      this.errorPositions.add(this.index);
      this.buffer = '';
      return { kind: 'error' };
    }

    if (candidate !== expected) {
      this.buffer = candidate;
      return { kind: 'progress' };
    }

    // Letra completa.
    this.buffer = '';
    this.stats.letters++;
    this.stats.chars++;
    this.index++;
    while (this.phrase[this.index] === ' ') {
      this.index++;
      this.stats.chars++;
    }
    if (this.index >= this.phrase.length) {
      this.stats.phrases++;
      this.stats.chars++; // espaço implícito entre frases
      this.loadPhrase();
      return { kind: 'phrase' };
    }
    return { kind: 'letter' };
  }

  private loadPhrase() {
    let p = '';
    // Evita frase vazia caso alguma só tenha caracteres sem Morse.
    for (let i = 0; i < 10 && !p; i++) p = normalize(this.nextPhrase());
    this.phrase = p || 'SOS';
    this.index = 0;
    this.buffer = '';
    this.errorPositions = new Set();
  }
}

export interface Results {
  lpm: number;
  wpm: number;
  accuracy: number;
  letters: number;
  errors: number;
  phrases: number;
}

export function computeResults(stats: SessionStats, elapsedMs: number): Results {
  const minutes = Math.max(elapsedMs, 1) / 60000;
  return {
    lpm: Math.round(stats.letters / minutes),
    wpm: Math.round((stats.chars / 5 / minutes) * 10) / 10,
    accuracy: stats.symbols ? Math.round(((stats.symbols - stats.errors) / stats.symbols) * 100) : 100,
    letters: stats.letters,
    errors: stats.errors,
    phrases: stats.phrases,
  };
}

/** Sorteia frases sem repetir a anterior. */
export function phrasePicker(list: string[], random = Math.random): () => string {
  let last = -1;
  return () => {
    if (list.length === 1) return list[0];
    let i: number;
    do i = Math.floor(random() * list.length);
    while (i === last);
    last = i;
    return list[i];
  };
}
