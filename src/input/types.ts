export type MorseSymbol = 'dot' | 'dash';

export type ControlMode = 'keyboard' | 'arrows' | 'space';

export interface InputEvents {
  /** Um ponto ou traço foi produzido. */
  onSymbol: (s: MorseSymbol) => void;
  /** Início de um toque (usado para som e barra de progresso no modo espaço). */
  onPressStart?: () => void;
  /** Fim de um toque. */
  onPressEnd?: () => void;
  /**
   * Fim de letra. Só é emitido se o jogo passar este callback
   * (ex.: tradutor). Teclado = espaço, setas = ↑, barra = pausa.
   * Dois seguidos significam espaço entre palavras.
   */
  onSeparator?: () => void;
}

/**
 * Todo controle só emite ponto/traço. Os jogos nunca sabem qual tecla foi usada,
 * então qualquer jogo novo suporta todos os controles automaticamente.
 */
export interface MorseInput {
  readonly mode: ControlMode;
  attach(events: InputEvents): void;
  detach(): void;
}

export const CONTROL_LABELS: Record<
  ControlMode,
  { name: string; hint: string; separatorHint: string }
> = {
  keyboard: {
    name: 'Teclado',
    hint: 'tecla . = ponto · tecla - = traço',
    separatorHint: 'espaço = fim da letra · 2× espaço = nova palavra',
  },
  arrows: {
    name: 'Setas',
    hint: '← = ponto · → = traço',
    separatorHint: '↑ = fim da letra · 2× ↑ = nova palavra · ↓ = apagar',
  },
  space: {
    name: 'Barra de espaço',
    hint: 'toque curto = ponto · segurar = traço',
    separatorHint: 'pausa curta = fim da letra · pausa longa = nova palavra',
  },
};

/** Pausa de palavra em relação à pausa de letra (no Morse padrão: 7 unidades vs 3). */
export const WORD_GAP_FACTOR = 7 / 3;
