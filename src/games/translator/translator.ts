import { Beeper } from '../../audio/beeper';
import { prettyCode } from '../../morse/alphabet';
import { createInput } from '../../input/createInput';
import { SpaceHoldInput } from '../../input/spaceHoldInput';
import type { MorseSymbol } from '../../input/types';
import {
  appHeader,
  GapMeter,
  gapSettingHtml,
  HoldMeter,
  ICONS,
  SignalLamp,
  SignalTape,
  wireGapSetting,
} from '../../ui/components';
import { controlPill, isEraseKey, legendHtml } from '../../ui/controlPicker';
import type { GameContext } from '../registry';
import { MorseDecoder } from './decoder';

// Fora da função de montagem: o texto continua lá ao trocar de controle ou voltar do menu.
const decoder = new MorseDecoder();

export function mountTranslator(ctx: GameContext): () => void {
  const { container, settings } = ctx;
  const beeper = new Beeper(settings.sound);
  const input = createInput(settings.control, {
    spaceThresholdMs: settings.spaceThresholdMs,
    letterGapMs: settings.letterGapMs,
  });
  const isSpace = settings.control === 'space';
  decoder.buffer = ''; // letra pela metade não sobrevive à troca de tela

  container.innerHTML = `
    <div class="screen translator">
      ${appHeader('Tradutor', controlPill(settings.control))}

      <div class="toolbar">
        ${isSpace ? gapSettingHtml(settings.letterGapMs) : ''}
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
          ${isSpace ? '<div class="meter-slot"></div><div class="gap-slot"></div>' : ''}
          <div class="tape-slot"></div>
          ${legendHtml(settings.control, { separator: true, erase: true })}
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
  const gapMeter = isSpace ? new GapMeter($('.gap-slot'), settings.letterGapMs) : null;

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
    beeper.start();
    lamp.on();
    meter?.begin();
    gapMeter?.press();
    tape.pressStart();
  }

  function onPressEnd() {
    beeper.stop();
    lamp.off();
    meter?.end();
    gapMeter?.release();
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

  wireGapSetting(container, (ms) => {
    ctx.updateSettings({ letterGapMs: ms });
    if (input instanceof SpaceHoldInput) input.letterGapMs = ms;
    if (gapMeter) gapMeter.letterGapMs = ms;
  });

  const onKey = (e: KeyboardEvent) => {
    if (isEraseKey(settings.control, e)) {
      e.preventDefault();
      if (decoder.buffer) tape.removeLetter();
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
    gapMeter?.stop();
    beeper.stop();
    tape.cancelLive();
    input.detach();
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
