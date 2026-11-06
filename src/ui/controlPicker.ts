import { CONTROL_LABELS, type ControlMode } from '../input/types';
import { CONTROL_ICONS, ICONS } from './components';

type Row = [keys: string, action: string];

/** Legenda de teclas de cada controle. `separator` só vale para o tradutor. */
export const LEGENDS: Record<ControlMode, { basic: Row[]; separator: Row[]; erase: Row }> = {
  keyboard: {
    basic: [['<kbd>.</kbd>', 'ponto'], ['<kbd>-</kbd>', 'traço']],
    separator: [
      ['<kbd>espaço</kbd>', 'fim da letra'],
      ['<kbd>espaço</kbd> ×2', 'nova palavra'],
    ],
    erase: ['<kbd>⌫</kbd>', 'apagar'],
  },
  arrows: {
    basic: [['<kbd>←</kbd>', 'ponto'], ['<kbd>→</kbd>', 'traço']],
    separator: [
      ['<kbd>↑</kbd>', 'fim da letra'],
      ['<kbd>↑</kbd> ×2', 'nova palavra'],
    ],
    erase: ['<kbd>↓</kbd> ou <kbd>⌫</kbd>', 'apagar'],
  },
  space: {
    basic: [['<kbd>espaço</kbd> rápido', 'ponto'], ['<kbd>espaço</kbd> segurado', 'traço']],
    separator: [
      ['pausa curta', 'fim da letra'],
      ['pausa longa', 'nova palavra'],
    ],
    erase: ['<kbd>⌫</kbd>', 'apagar'],
  },
};

/** Teclas que apagam no controle escolhido (Backspace sempre; ↓ no modo setas). */
export function isEraseKey(mode: ControlMode, e: KeyboardEvent): boolean {
  return e.key === 'Backspace' || (mode === 'arrows' && e.key === 'ArrowDown');
}

export function legendHtml(
  mode: ControlMode,
  opts: {
    separator?: boolean;
    erase?: boolean;
    /** Troca o texto "nova palavra" (ex.: "enviar" na Escuta). */
    wordLabel?: string;
    extra?: Row[];
  } = {},
): string {
  const l = LEGENDS[mode];
  const separator: Row[] = l.separator.map(([k, a]) => [k, a === 'nova palavra' && opts.wordLabel ? opts.wordLabel : a]);
  const rows = [
    ...l.basic,
    ...(opts.separator ? separator : []),
    ...(opts.erase ? [l.erase] : []),
    ...(opts.extra ?? []),
  ];
  return `<ul class="legend">${rows
    .map(([k, a]) => `<li><span class="legend-keys">${k}</span><span class="legend-action">${a}</span></li>`)
    .join('')}</ul>`;
}

export const CONTROL_ORDER: ControlMode[] = ['keyboard', 'arrows', 'space'];

export function nextControl(mode: ControlMode): ControlMode {
  return CONTROL_ORDER[(CONTROL_ORDER.indexOf(mode) + 1) % CONTROL_ORDER.length];
}

/** Botão com o controle ativo; cada clique troca para o próximo (tratado em main.ts). */
export function controlPill(mode: ControlMode): string {
  const next = CONTROL_LABELS[nextControl(mode)].name;
  return `
    <button class="pill pill-btn" data-act="cycle-control" title="Trocar para ${next}">
      ${CONTROL_ICONS[mode]}${CONTROL_LABELS[mode].name}
      <span class="pill-swap">${ICONS.swap}</span>
    </button>`;
}

/** Seletor de controle reutilizável por qualquer tela. */
export function controlPicker(current: ControlMode, onChange: (m: ControlMode) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'control-picker';
  const modes = Object.keys(CONTROL_LABELS) as ControlMode[];
  el.innerHTML = modes
    .map(
      (m) => `
      <button class="control-card ${m === current ? 'active' : ''}" data-mode="${m}">
        <span class="control-check"></span>
        <span class="control-icon">${CONTROL_ICONS[m]}</span>
        <span class="control-name">${CONTROL_LABELS[m].name}</span>
        ${legendHtml(m)}
      </button>`,
    )
    .join('');
  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]');
    if (!btn) return;
    el.querySelectorAll('.control-card').forEach((c) => c.classList.toggle('active', c === btn));
    onChange(btn.dataset.mode as ControlMode);
    btn.blur();
  });
  return el;
}
