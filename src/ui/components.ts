import type { ControlMode, MorseSymbol } from '../input/types';

/* ---------------- ícones (SVG inline) ---------------- */

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  keyboard: svg('<rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'),
  arrows: svg('<path d="M9 7 4 12l5 5M15 7l5 5-5 5"/>'),
  space: svg('<path d="M3 10v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
  translate: svg('<path d="M4 6h9M8.5 4v2M6 6c0 4 3 7 6 8M11 6c-1 4-4 7-7 8M13 20l4-9 4 9M14.5 17h5"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  sound: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  restart: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};

export const CONTROL_ICONS: Record<ControlMode, string> = {
  keyboard: ICONS.keyboard,
  arrows: ICONS.arrows,
  space: ICONS.space,
};

/* ---------------- cabeçalho ---------------- */

/** Barra superior com a marca (clicar volta ao menu) e o nome da tela atual. */
export function appHeader(crumb?: string, right = ''): string {
  return `
    <header class="appbar">
      <button class="brand" data-act="menu" title="Voltar ao menu">
        <span class="brand-mark"><i></i><i class="d"></i><i></i></span>
        <span class="brand-name">Morse<b>Lab</b></span>
      </button>
      ${crumb ? `<span class="crumb-sep">/</span><span class="crumb">${crumb}</span>` : ''}
      <div class="appbar-right">${right}</div>
    </header>`;
}

/* ---------------- lâmpada de sinal ---------------- */

/** Luz que acende a cada ponto/traço, como num telégrafo óptico. */
export class SignalLamp {
  private timer?: number;

  constructor(private el: HTMLElement) {
    el.classList.add('lamp');
    el.innerHTML = '<span class="lamp-core"></span>';
  }

  on() {
    clearTimeout(this.timer);
    this.el.classList.remove('err');
    this.el.classList.add('on');
  }

  off() {
    this.el.classList.remove('on');
  }

  flash(sym: MorseSymbol) {
    this.on();
    this.timer = window.setTimeout(() => this.off(), sym === 'dot' ? 90 : 260);
  }

  error() {
    clearTimeout(this.timer);
    this.el.classList.remove('on');
    this.el.classList.add('err');
    this.timer = window.setTimeout(() => this.el.classList.remove('err'), 280);
  }
}

/* ---------------- fita de sinal ---------------- */

const MAX_TAPE_ITEMS = 90;

/**
 * Fita que desenha os sinais conforme são digitados.
 * No modo barra de espaço, o sinal cresce ao vivo enquanto a tecla está pressionada.
 */
export class SignalTape {
  private track: HTMLElement;
  private live?: HTMLElement;
  private liveStart = 0;
  private raf?: number;

  constructor(el: HTMLElement, private thresholdMs = 200) {
    el.classList.add('tape');
    el.innerHTML = '<div class="tape-track"></div>';
    this.track = el.firstElementChild as HTMLElement;
  }

  setThreshold(ms: number) {
    this.thresholdMs = ms;
  }

  pressStart() {
    this.cancelLive();
    this.live = this.add('sig live');
    this.liveStart = performance.now();
    const grow = () => {
      if (!this.live) return;
      const held = performance.now() - this.liveStart;
      // 10px no início, até ~70px segurando bastante
      this.live.style.width = `${10 + Math.min(held / this.thresholdMs, 2.5) * 24}px`;
      this.live.classList.toggle('is-dash', held >= this.thresholdMs);
      this.raf = requestAnimationFrame(grow);
    };
    grow();
  }

  /** Registra um símbolo (finaliza o sinal ao vivo se houver). */
  symbol(sym: MorseSymbol) {
    if (this.live) {
      cancelAnimationFrame(this.raf!);
      this.live.removeAttribute('style');
      this.live.className = `sig ${sym}`;
      this.live = undefined;
    } else {
      this.add(`sig ${sym}`);
    }
  }

  /** Espaço entre letras (ou palavras, se `word`). */
  gap(word = false) {
    const last = this.track.lastElementChild;
    if (!last) return;
    if (last.classList.contains('gap')) {
      if (word) last.className = 'gap word';
      return;
    }
    this.add(word ? 'gap word' : 'gap');
  }

  /** Pinta de vermelho os sinais desde o último espaço. */
  markError() {
    let el = this.track.lastElementChild;
    while (el && !el.classList.contains('gap')) {
      el.classList.add('err');
      el = el.previousElementSibling;
    }
    this.gap();
  }

  /** Remove o último sinal (usado ao apagar). */
  removeLast() {
    const last = this.track.lastElementChild;
    if (last?.classList.contains('gap')) last.remove();
    this.track.lastElementChild?.remove();
  }

  clear() {
    this.cancelLive();
    this.track.innerHTML = '';
  }

  cancelLive() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.live?.remove();
    this.live = undefined;
  }

  private add(cls: string): HTMLElement {
    const s = document.createElement('span');
    s.className = cls;
    this.track.appendChild(s);
    while (this.track.childElementCount > MAX_TAPE_ITEMS) this.track.firstElementChild!.remove();
    return s;
  }
}

/* ---------------- barra de segurar (modo espaço) ---------------- */

/** Mostra quanto tempo o espaço está pressionado e onde o ponto vira traço. */
export class HoldMeter {
  private start: number | null = null;
  private raf?: number;
  private fill: HTMLElement;

  constructor(private el: HTMLElement, private thresholdMs: number) {
    el.classList.add('meter');
    el.innerHTML = `
      <div class="meter-bar"><div class="meter-fill"></div><div class="meter-mark" style="left:50%"></div></div>
      <div class="meter-labels"><span>ponto</span><span>traço</span></div>`;
    this.fill = el.querySelector('.meter-fill')!;
  }

  begin() {
    this.start = performance.now();
    this.el.classList.add('active');
    const loop = () => {
      if (this.start === null) return;
      const held = performance.now() - this.start;
      this.fill.style.width = `${Math.min(held / (this.thresholdMs * 2), 1) * 100}%`;
      this.el.classList.toggle('dash', held >= this.thresholdMs);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  end() {
    this.start = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.el.classList.remove('active', 'dash');
    this.fill.style.width = '0%';
  }
}
