import { WORD_GAP_FACTOR, type InputEvents, type MorseInput } from './types';

/**
 * Barra de espaço: o tempo segurado decide o símbolo.
 * Menos que `thresholdMs` = ponto, a partir disso = traço.
 * Se o jogo pedir separadores, uma pausa de `letterGapMs` fecha a letra
 * e uma pausa maior (× WORD_GAP_FACTOR) conta como espaço entre palavras.
 */
export class SpaceHoldInput implements MorseInput {
  readonly mode = 'space' as const;
  private events?: InputEvents;
  private pressedAt: number | null = null;
  private gapTimers: number[] = [];

  constructor(
    public thresholdMs: number,
    public letterGapMs: number,
  ) {}

  private clearGaps() {
    this.gapTimers.forEach((t) => clearTimeout(t));
    this.gapTimers = [];
  }

  private down = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !this.events) return;
    e.preventDefault();
    if (e.repeat || this.pressedAt !== null) return;
    this.clearGaps();
    this.pressedAt = performance.now();
    this.events.onPressStart?.();
  };

  private up = (e: KeyboardEvent) => {
    if (e.code !== 'Space' || !this.events) return;
    e.preventDefault();
    if (this.pressedAt === null) return;
    const held = performance.now() - this.pressedAt;
    this.pressedAt = null;
    this.events.onPressEnd?.();
    this.events.onSymbol(held < this.thresholdMs ? 'dot' : 'dash');
    if (this.events.onSeparator) {
      const fire = () => this.events?.onSeparator?.();
      this.gapTimers.push(
        window.setTimeout(fire, this.letterGapMs),
        window.setTimeout(fire, this.letterGapMs * WORD_GAP_FACTOR),
      );
    }
  };

  // Se a janela perder o foco com o espaço pressionado, cancela o toque.
  private blur = () => {
    if (this.pressedAt !== null) {
      this.pressedAt = null;
      this.events?.onPressEnd?.();
    }
  };

  attach(events: InputEvents) {
    this.events = events;
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }

  detach() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
    this.clearGaps();
    this.pressedAt = null;
    this.events = undefined;
  }
}
