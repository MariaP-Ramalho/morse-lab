import { describe, expect, it } from 'vitest';
import { MorseDecoder } from './decoder';

function feed(d: MorseDecoder, morse: string) {
  // '.' e '-' = símbolos, ' ' = separador
  for (const c of morse) {
    if (c === ' ') d.separator();
    else d.push(c === '.' ? 'dot' : 'dash');
  }
}

describe('MorseDecoder', () => {
  it('decodifica letras separadas', () => {
    const d = new MorseDecoder();
    feed(d, '... --- ... ');
    expect(d.text).toBe('SOS');
  });

  it('dois separadores viram espaço entre palavras (sem repetir)', () => {
    const d = new MorseDecoder();
    feed(d, '.. ..  ..   ');
    expect(d.text).toBe('II I ');
  });

  it('não começa com espaço', () => {
    const d = new MorseDecoder();
    feed(d, '   .- ');
    expect(d.text).toBe('A');
  });

  it('código inválido vira letra desconhecida', () => {
    const d = new MorseDecoder();
    feed(d, '........ ');
    expect(d.entries[0].unknown).toBe(true);
  });

  it('mostra prévia da letra em andamento', () => {
    const d = new MorseDecoder();
    feed(d, '.-');
    expect(d.preview).toBe('A');
    expect(d.text).toBe('');
  });

  it('backspace apaga símbolo e depois letra', () => {
    const d = new MorseDecoder();
    feed(d, '.- -.');
    d.backspace();
    expect(d.buffer).toBe('-');
    d.backspace();
    d.backspace();
    expect(d.text).toBe('');
  });
});
