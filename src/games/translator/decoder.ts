import { fromMorse } from '../../morse/alphabet';
import type { MorseSymbol } from '../../input/types';

export interface Entry {
  /** Letra decodificada, ' ' para espaço entre palavras. */
  ch: string;
  /** Código digitado ('/' para espaço). */
  code: string;
  /** Código que não corresponde a nenhuma letra. */
  unknown?: boolean;
}

/** Lógica pura do tradutor: junta símbolos em letras quando recebe um separador. */
export class MorseDecoder {
  buffer = '';
  entries: Entry[] = [];

  /** Letra que o buffer atual formaria se fosse fechado agora. */
  get preview(): string | undefined {
    return this.buffer ? fromMorse(this.buffer) : undefined;
  }

  get text(): string {
    return this.entries.map((e) => (e.unknown ? '?' : e.ch)).join('');
  }

  push(sym: MorseSymbol) {
    this.buffer += sym === 'dot' ? '.' : '-';
  }

  /** Fecha a letra atual; se não há letra em andamento, insere espaço entre palavras. */
  separator() {
    if (this.buffer) {
      const ch = fromMorse(this.buffer);
      this.entries.push(ch ? { ch, code: this.buffer } : { ch: '?', code: this.buffer, unknown: true });
      this.buffer = '';
      return;
    }
    const last = this.entries[this.entries.length - 1];
    if (last && last.ch !== ' ') this.entries.push({ ch: ' ', code: '/' });
  }

  /** Apaga a letra em andamento inteira (todos os pontos e traços); se não houver, apaga a última letra. */
  backspace() {
    if (this.buffer) this.buffer = '';
    else this.entries.pop();
  }

  clear() {
    this.buffer = '';
    this.entries = [];
  }
}
