/** Tabela Morse internacional. '.' = ponto, '-' = traço. */
export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--',
};

export function toMorse(char: string): string | undefined {
  return MORSE[char.toUpperCase()];
}

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([c, code]) => [code, c]),
);

/** Código → letra (undefined se não existir). */
export function fromMorse(code: string): string | undefined {
  return REVERSE[code];
}

/** Converte '.-' em '·—' para exibição. */
export function prettyCode(code: string): string {
  return code.replace(/\./g, '·').replace(/-/g, '—');
}
