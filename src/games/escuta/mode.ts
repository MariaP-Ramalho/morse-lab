import { SPEED_NAMES, speedBand, WPM_MAX, WPM_MIN } from '../../shared/results';

/** Os dois modos da Escuta ficam em endereços próprios: #escuta e #escuta-letras. */
export type EscutaMode = 'palavra' | 'letras';

const MODE_HASH: Record<EscutaMode, string> = { palavra: 'escuta', letras: 'escuta-letras' };

/** Seletor "palavra secreta / letra a letra" do topo da Escuta. */
export function escutaModeSeg(active: EscutaMode): string {
  const btn = (mode: EscutaMode, label: string) =>
    `<button data-mode="${mode}" class="${mode === active ? 'active' : ''}">${label}</button>`;
  return `<div class="seg mode-seg" aria-label="Modo da Escuta">${btn('palavra', 'palavra secreta')}${btn('letras', 'letra a letra')}</div>`;
}

/** Troca de modo se o clique foi no seletor. Devolve true quando tratou o clique. */
export function onModeClick(target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>('[data-mode]');
  if (!btn) return false;
  location.hash = MODE_HASH[btn.dataset.mode as EscutaMode];
  return true;
}

/** Barra de velocidade do áudio (palavras por minuto), com a faixa ao lado. */
export function speedControlHtml(wpm: number): string {
  return `
    <label class="speed-control" title="Velocidade do áudio em palavras por minuto">
      <span class="speed-label">velocidade</span>
      <input type="range" min="${WPM_MIN}" max="${WPM_MAX}" step="1" value="${wpm}" aria-label="Velocidade do áudio em palavras por minuto" />
      <span class="speed-value"><b>${wpm}</b> ppm <small>${SPEED_NAMES[speedBand(wpm)]}</small></span>
    </label>`;
}

/**
 * Liga a barra: o número muda enquanto arrasta; `onCommit` roda ao soltar
 * (ou a cada passo pelas setas do teclado).
 */
export function wireSpeedControl(container: HTMLElement, onCommit: (wpm: number) => void): void {
  const input = container.querySelector<HTMLInputElement>('.speed-control input')!;
  const value = container.querySelector<HTMLElement>('.speed-value')!;
  const show = () => {
    const wpm = Number(input.value);
    value.innerHTML = `<b>${wpm}</b> ppm <small>${SPEED_NAMES[speedBand(wpm)]}</small>`;
  };
  input.addEventListener('input', show);
  input.addEventListener('change', () => {
    show();
    onCommit(Number(input.value));
  });
}
