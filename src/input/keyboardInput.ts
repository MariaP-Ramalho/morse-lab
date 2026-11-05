import type { InputEvents, MorseInput } from './types';

/** Tecla '.' (ou Numpad .) = ponto; '-' (ou Numpad -) = traço. */
export class KeyboardInput implements MorseInput {
  readonly mode = 'keyboard' as const;
  private events?: InputEvents;

  private handler = (e: KeyboardEvent) => {
    if (e.repeat || !this.events || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '.' || e.code === 'NumpadDecimal') {
      e.preventDefault();
      this.events.onSymbol('dot');
    } else if (e.key === '-' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      this.events.onSymbol('dash');
    } else if (e.code === 'Space' && this.events.onSeparator) {
      e.preventDefault();
      this.events.onSeparator();
    }
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
