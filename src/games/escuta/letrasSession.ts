/**
 * Lógica do modo "letra a letra" da Escuta: toca uma letra por vez
 * e a pessoa responde digitando a letra normal. Sem DOM nem som, para ser testável.
 */

import { ALPHABET } from '../../settings';

export const LETTERS = ALPHABET;

export interface LetrasAnswer {
  /** Letra que tocou. */
  letter: string;
  /** Letra que a pessoa digitou. */
  typed: string;
  ok: boolean;
}

/**
 * Sorteia letras do conjunto sem repetir a anterior (repetir confunde: parece que o som não mudou).
 * O conjunto precisa ter pelo menos 2 letras.
 */
export function letterPicker(letters = LETTERS, random = Math.random): (prev?: string) => string {
  return (prev) => {
    let c: string;
    do c = letters[Math.floor(random() * letters.length)];
    while (c === prev);
    return c;
  };
}

export class LetrasSession {
  answers: LetrasAnswer[] = [];
  current: string;

  constructor(private pick: (prev?: string) => string = letterPicker()) {
    this.current = pick();
  }

  get correct(): number {
    return this.answers.filter((a) => a.ok).length;
  }

  get errors(): number {
    return this.answers.length - this.correct;
  }

  /** Porcentagem de acertos (0 sem respostas). */
  get accuracy(): number {
    return this.answers.length ? Math.round((this.correct / this.answers.length) * 100) : 0;
  }

  /** Letras que tocaram e foram respondidas errado, na ordem. */
  get missed(): string {
    return this.answers
      .filter((a) => !a.ok)
      .map((a) => a.letter)
      .join('');
  }

  /** Responde a letra atual e já sorteia a próxima. */
  answer(typed: string): LetrasAnswer {
    const a = { letter: this.current, typed, ok: typed === this.current };
    this.answers.push(a);
    this.current = this.pick(this.current);
    return a;
  }
}
