import type { InputEvents, MorseInput } from './types';

/** Seta esquerda = ponto; seta direita = traço. */
export class ArrowInput implements MorseInput {
  readonly mode = 'arrows' as const;
  private events?: InputEvents;

  private handler = (e: KeyboardEvent) => {
    if (!this.events) return;
    if (e.key === 'ArrowUp' && this.events.onSeparator) {
      e.preventDefault();
      if (!e.repeat) this.events.onSeparator();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    if (e.repeat) return;
    this.events.onSymbol(e.key === 'ArrowLeft' ? 'dot' : 'dash');
  };

  attach(events: InputEvents) {
    this.events = events;
    window.addEventListener('keydown', this.handler);
  }

  detach() {
    window.removeEventListener('keydown', this.handler);
    this.events = undefined;
  }
}
