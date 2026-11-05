import { CONTROL_LABELS, type ControlMode } from '../input/types';
import { CONTROL_ICONS } from './components';

type Row = [keys: string, action: string];

/** Legenda de teclas de cada controle. `separator` só vale para o tradutor. */
export const LEGENDS: Record<ControlMode, { basic: Row[]; separator: Row[] }> = {
  keyboard: {
    basic: [['<kbd>.</kbd>', 'ponto'], ['<kbd>-</kbd>', 'traço']],
    separator: [
      ['<kbd>espaço</kbd>', 'fim da letra'],
      ['<kbd>espaço</kbd> ×2', 'nova palavra'],
      ['<kbd>⌫</kbd>', 'apagar'],
    ],
  },
  arrows: {
    basic: [['<kbd>←</kbd>', 'ponto'], ['<kbd>→</kbd>', 'traço']],
    separator: [
      ['<kbd>↑</kbd>', 'fim da letra'],
      ['<kbd>↑</kbd> ×2', 'nova palavra'],
      ['<kbd>↓</kbd> ou <kbd>⌫</kbd>', 'apagar'],
    ],
  },
  space: {
    basic: [['<kbd>espaço</kbd> rápido', 'ponto'], ['<kbd>espaço</kbd> segurado', 'traço']],
    separator: [
      ['pausa curta', 'fim da letra'],
      ['pausa longa', 'nova palavra'],
      ['<kbd>⌫</kbd>', 'apagar'],
    ],
  },
};

export function legendHtml(mode: ControlMode, withSeparator = false): string {
  const rows = [...LEGENDS[mode].basic, ...(withSeparator ? LEGENDS[mode].separator : [])];
  return `<ul class="legend">${rows
    .map(([k, a]) => `<li><span class="legend-keys">${k}</span><span class="legend-action">${a}</span></li>`)
    .join('')}</ul>`;
}

/** Selo compacto com o controle ativo. */
export function controlPill(mode: ControlMode): string {
  return `<span class="pill">${CONTROL_ICONS[mode]}${CONTROL_LABELS[mode].name}</span>`;
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
