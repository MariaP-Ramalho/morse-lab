import { Beeper } from '../../audio/beeper';
import { prettyCode } from '../../morse/alphabet';
import { createInput } from '../../input/createInput';
import { SpaceHoldInput } from '../../input/spaceHoldInput';
import { WORD_GAP_FACTOR, type MorseSymbol } from '../../input/types';
import { appHeader, HoldMeter, ICONS, SignalLamp, SignalTape } from '../../ui/components';
import { controlPill, legendHtml } from '../../ui/controlPicker';
import type { GameContext } from '../registry';
import { MorseDecoder } from './decoder';

export function mountTranslator(ctx: GameContext): () => void {
  const { container, settings } = ctx;
  const beeper = new Beeper(settings.sound);
  const input = createInput(settings.control, {
    spaceThresholdMs: settings.spaceThresholdMs,
    letterGapMs: settings.letterGapMs,
  });
  const isSpace = settings.control === 'space';
  const isArrows = settings.control === 'arrows';
  const decoder = new MorseDecoder();
  const letterMarkPct = (1 / WORD_GAP_FACTOR) * 100;

  container.innerHTML = `
    <div class="screen translator">
      ${appHeader('Tradutor', controlPill(settings.control))}

      <div class="toolbar">
        ${
          isSpace
            ? `<label class="gap-setting">
                 <span>Pausa entre letras</span>
                 <input type="range" min="250" max="1500" step="50" value="${settings.letterGapMs}" />
                 <b class="gap-value">${settings.letterGapMs} ms</b>
               </label>`
            : ''
        }
        <span class="toolbar-spacer"></span>
        <button class="btn ghost small" data-act="copy">${ICONS.copy}<span class="copy-label">copiar</span></button>
        <button class="btn ghost small" data-act="clear">${ICONS.trash}limpar</button>
      </div>

      <div class="translator-grid">
        <div class="card paper">
          <div class="card-label">Texto</div>
          <div class="output"></div>
          <div class="card-label">Morse</div>
          <div class="transcript"></div>
        </div>

        <div class="card keyer-card">
          <div class="keyer">
            <div class="lamp-slot"></div>
            <div class="keyer-target">
              <span class="preview"></span>
              <span class="code"></span>
            </div>
          </div>
          ${
            isSpace
              ? `<div class="meter-slot"></div>
                 <div class="meter gapmeter">
                   <div class="meter-bar">
                     <div class="meter-fill"></div>
                     <div class="meter-mark" style="left:${letterMarkPct}%"></div>
                   </div>
                   <div class="meter-labels">
                     <span style="width:${letterMarkPct}%">letra</span><span>palavra</span>
                   </div>
                 </div>`
              : ''
          }
          <div class="tape-slot"></div>
          ${legendHtml(settings.control, true)}
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => container.querySelector(sel) as T;
  const outputEl = $('.output');
  const codeEl = $('.code');
  const previewEl = $('.preview');
  const transcriptEl = $('.transcript');
  const copyLabel = $('.copy-label');
  const lamp = new SignalLamp($('.lamp-slot'));
  const tape = new SignalTape($('.tape-slot'), settings.spaceThresholdMs);
  const meter = isSpace ? new HoldMeter($('.meter-slot'), settings.spaceThresholdMs) : null;
  const gapMeter = isSpace ? $('.gapmeter') : null;
  const gapFill = gapMeter?.querySelector<HTMLElement>('.meter-fill');

  let releasedAt: number | null = null;
  let rafId: number | undefined;

  const wordGapMs = () => settings.letterGapMs * WORD_GAP_FACTOR;

  function blurFocus() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function render() {
    if (!decoder.entries.length) {
      outputEl.innerHTML = '<span class="placeholder">Comece a transmitir…</span><span class="caret"></span>';
    } else {
      outputEl.innerHTML =
        decoder.entries
          .map((e) => (e.ch === ' ' ? ' ' : `<span class="${e.unknown ? 'unk' : ''}">${e.ch}</span>`))
          .join('') + '<span class="caret"></span>';
    }

    codeEl.innerHTML = decoder.buffer
      ? decoder.buffer.split('').map((s) => `<span class="typed">${prettyCode(s)}</span>`).join('')
      : '<span class="ghost">·—</span>';
    previewEl.textContent = decoder.buffer ? (decoder.preview ?? '?') : '';
    previewEl.classList.toggle('unk', !!decoder.buffer && !decoder.preview);

    transcriptEl.innerHTML = decoder.entries.length
      ? decoder.entries
          .map((e) => (e.code === '/' ? '<span class="slash">/</span>' : `<span>${prettyCode(e.code)}</span>`))
          .join(' ')
      : '<span class="placeholder">—</span>';
  }

  // ---- eventos dos controles ----
  function onSymbol(sym: MorseSymbol) {
    if (!isSpace) {
      beeper.beep(sym);
      lamp.flash(sym);
    }
    tape.symbol(sym);
    decoder.push(sym);
    render();
  }

  function onSeparator() {
    const hadLetter = !!decoder.buffer;
    decoder.separator();
    const last = decoder.entries[decoder.entries.length - 1];
    if (hadLetter && last?.unknown) tape.markError();
    else tape.gap(!hadLetter);
    render();
  }

  function onPressStart() {
    releasedAt = null;
    beeper.start();
    lamp.on();
    meter?.begin();
    tape.pressStart();
    gapMeter?.classList.remove('letter-done', 'word-done');
    if (gapFill) gapFill.style.width = '0%';
  }

  function onPressEnd() {
    beeper.stop();
    lamp.off();
    meter?.end();
    releasedAt = performance.now();
    animateGap();
  }

  // Barra de pausa: mostra quanto falta para fechar a letra e para virar espaço.
  function animateGap() {
    if (rafId) cancelAnimationFrame(rafId);
    const loop = () => {
      if (releasedAt === null || !gapMeter || !gapFill) return;
      const gap = performance.now() - releasedAt;
      gapFill.style.width = `${Math.min(gap / wordGapMs(), 1) * 100}%`;
      gapMeter.classList.add('active');
      gapMeter.classList.toggle('letter-done', gap >= settings.letterGapMs);
      gapMeter.classList.toggle('word-done', gap >= wordGapMs());
      if (gap >= wordGapMs()) {
        releasedAt = null;
        gapMeter.classList.remove('active');
        return;
      }
      rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  // ---- interface ----
  const onClick = async (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'menu') {
      ctx.exit();
      return;
    }
    blurFocus();
    if (act === 'clear') {
      decoder.clear();
      tape.clear();
      render();
    } else if (act === 'copy') {
      try {
        await navigator.clipboard.writeText(decoder.text);
        copyLabel.textContent = 'copiado!';
      } catch {
        copyLabel.textContent = 'erro ao copiar';
      }
      setTimeout(() => (copyLabel.textContent = 'copiar'), 1200);
    }
  };

  const range = container.querySelector<HTMLInputElement>('.gap-setting input');
  const onRange = () => {
    if (!range) return;
    const ms = Number(range.value);
    ctx.updateSettings({ letterGapMs: ms });
    if (input instanceof SpaceHoldInput) input.letterGapMs = ms;
    container.querySelector('.gap-value')!.textContent = `${ms} ms`;
  };
  range?.addEventListener('input', onRange);
  range?.addEventListener('change', blurFocus);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' || (isArrows && e.key === 'ArrowDown')) {
      e.preventDefault();
      if (decoder.buffer) tape.removeLast();
      decoder.backspace();
      render();
    }
  };

  container.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  input.attach({ onSymbol, onSeparator, onPressStart, onPressEnd });
  blurFocus();
  render();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    beeper.stop();
    tape.cancelLive();
    input.detach();
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
