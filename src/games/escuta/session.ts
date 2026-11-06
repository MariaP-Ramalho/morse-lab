export type TileState = 'correct' | 'present' | 'absent';

export const MAX_ATTEMPTS = 6;

/**
 * Compara o palpite com a resposta. Letras repetidas só contam
 * quantas vezes aparecem na resposta.
 */
export function scoreGuess(guess: string, answer: string): TileState[] {
  const result: TileState[] = Array(guess.length).fill('absent');
  const remaining: Record<string, number> = {};
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
      result[i] = 'present';
      remaining[guess[i]]--;
    }
  }
  return result;
}

const RANK: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };

export type TypeResult = 'letter' | 'full' | 'none';
export type EnterResult = 'submitted' | 'incomplete' | 'none';

/** Lógica pura do jogo Escuta: o palpite é digitado letra a letra no teclado comum. */
export class EscutaSession {
  rows: { word: string; states: TileState[] }[] = [];
  /** Letras do palpite atual. */
  current = '';
  status: 'playing' | 'won' | 'lost' = 'playing';
  /** Melhor estado conhecido de cada letra (para o painel de letras). */
  letterStates: Record<string, TileState> = {};

  constructor(public readonly answer: string) {}

  get length(): number {
    return this.answer.length;
  }

  /** Acrescenta uma letra (A–Z) ao palpite. */
  type(letter: string): TypeResult {
    if (this.status !== 'playing' || !/^[A-Z]$/.test(letter)) return 'none';
    if (this.current.length >= this.length) return 'full';
    this.current += letter;
    return 'letter';
  }

  /** Enter: envia o palpite se a linha estiver completa. */
  enter(): EnterResult {
    if (this.status !== 'playing') return 'none';
    if (this.current.length < this.length) return 'incomplete';
    this.submit();
    return 'submitted';
  }

  backspace() {
    if (this.status !== 'playing') return;
    this.current = this.current.slice(0, -1);
  }

  private submit() {
    const word = this.current;
    const states = scoreGuess(word, this.answer);
    this.rows.push({ word, states });
    states.forEach((s, i) => {
      const prev = this.letterStates[word[i]];
      if (!prev || RANK[s] > RANK[prev]) this.letterStates[word[i]] = s;
    });
    this.current = '';
    if (word === this.answer) this.status = 'won';
    else if (this.rows.length >= MAX_ATTEMPTS) this.status = 'lost';
  }
}
