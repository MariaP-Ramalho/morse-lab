import { MORSE } from './alphabet';

/**
 * Prepara um texto para Morse: maiúsculas, sem acentos,
 * só caracteres com código Morse e espaços simples.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split('')
    .filter((c) => /\s/.test(c) || c in MORSE)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
