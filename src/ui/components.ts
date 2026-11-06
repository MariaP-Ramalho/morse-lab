import { WORD_GAP_FACTOR, type ControlMode, type MorseSymbol } from '../input/types';

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
  headphones: svg('<path d="M3 15v-3a9 9 0 0 1 18 0v3"/><rect x="3" y="14" width="4.5" height="7" rx="1.5"/><rect x="16.5" y="14" width="4.5" height="7" rx="1.5"/>'),
  play: svg('<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>'),
  stop: svg('<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"/>'),
  swap: svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
  eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  chart: svg('<path d="M4 4v16h16"/><path d="m8 15 3-4 3 2 4-6"/>'),
};

export const CONTROL_ICONS: Record<ControlMode, string> = {
  keyboard: ICONS.keyboard,
  arrows: ICONS.arrows,
  space: ICONS.space,
};

/* ---------------- cabeçalho ---------------- */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Atalho para o progresso no canto do cabeçalho. */
const progressChip = () =>
  `<a class="pill pill-btn progress-chip" href="#progresso" title="Ver meu progresso">${ICONS.chart}progresso</a>`;

/** Barra superior com a marca (clicar volta ao menu), o nome da tela atual e o atalho do progresso. */
export function appHeader(crumb?: string, right = ''): string {
  return `
    <header class="appbar">
      <button class="brand" data-act="menu" title="Voltar ao menu">
        <span class="brand-mark"><i></i><i class="d"></i><i></i></span>
        <span class="brand-name">Morse<b>Lab</b></span>
      </button>
      ${crumb ? `<span class="crumb-sep">/</span><span class="crumb">${crumb}</span>` : ''}
      <div class="appbar-right">${right}${progressChip()}</div>
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

  /** Remove os sinais da letra em andamento, desde o último espaço (o sinal ao vivo fica). */
  removeLetter() {
    let el = this.track.lastElementChild;
    while (el && !el.classList.contains('gap')) {
      const prev = el.previousElementSibling;
      if (el !== this.live) el.remove();
      el = prev;
    }
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

/* ---------------- barra de pausa (modo espaço com separadores) ---------------- */

/**
 * Depois de soltar o espaço, mostra quanto falta para fechar a letra
 * e para a pausa longa (nova palavra / enviar).
 */
export class GapMeter {
  private releasedAt: number | null = null;
  private raf?: number;
  private fill: HTMLElement;

  constructor(private el: HTMLElement, public letterGapMs: number, longLabel = 'palavra') {
    const pct = (1 / WORD_GAP_FACTOR) * 100;
    el.classList.add('meter', 'gapmeter');
    el.innerHTML = `
      <div class="meter-bar"><div class="meter-fill"></div><div class="meter-mark" style="left:${pct}%"></div></div>
      <div class="meter-labels"><span style="width:${pct}%">letra</span><span>${longLabel}</span></div>`;
    this.fill = el.querySelector('.meter-fill')!;
  }

  press() {
    this.releasedAt = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.el.classList.remove('active', 'letter-done', 'word-done');
    this.fill.style.width = '0%';
  }

  release() {
    this.releasedAt = performance.now();
    const wordGap = () => this.letterGapMs * WORD_GAP_FACTOR;
    const loop = () => {
      if (this.releasedAt === null) return;
      const gap = performance.now() - this.releasedAt;
      this.fill.style.width = `${Math.min(gap / wordGap(), 1) * 100}%`;
      this.el.classList.add('active');
      this.el.classList.toggle('letter-done', gap >= this.letterGapMs);
      this.el.classList.toggle('word-done', gap >= wordGap());
      if (gap >= wordGap()) {
        this.releasedAt = null;
        this.el.classList.remove('active');
        return;
      }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.releasedAt = null;
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

/* ---------------- ajuste da pausa entre letras ---------------- */

export function gapSettingHtml(ms: number): string {
  return `
    <label class="gap-setting">
      <span>Pausa entre letras</span>
      <input type="range" min="250" max="1500" step="50" value="${ms}" />
      <b class="gap-value">${ms} ms</b>
    </label>`;
}

/** Liga o controle deslizante criado por gapSettingHtml. */
export function wireGapSetting(root: HTMLElement, onChange: (ms: number) => void) {
  const range = root.querySelector<HTMLInputElement>('.gap-setting input');
  if (!range) return;
  range.addEventListener('input', () => {
    const ms = Number(range.value);
    root.querySelector('.gap-value')!.textContent = `${ms} ms`;
    onChange(ms);
  });
  range.addEventListener('change', () => range.blur());
}
