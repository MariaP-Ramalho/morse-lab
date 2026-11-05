import { Beeper } from '../../audio/beeper';
import { prettyCode } from '../../morse/alphabet';
import { createInput } from '../../input/createInput';
import { CONTROL_LABELS, type MorseSymbol } from '../../input/types';
import { appHeader, HoldMeter, ICONS, SignalLamp, SignalTape } from '../../ui/components';
import { controlPill, legendHtml } from '../../ui/controlPicker';
import type { GameContext } from '../registry';
import { PHRASES_PT } from './phrases.pt';
import { computeResults, phrasePicker, TypingSession } from './session';

const DURATIONS = [15, 30, 60, 120];

export function mountTypingGame(ctx: GameContext): () => void {
  const { container, settings } = ctx;
  const beeper = new Beeper(settings.sound);
  const pick = phrasePicker(PHRASES_PT);
  const input = createInput(settings.control, { spaceThresholdMs: settings.spaceThresholdMs });
  const isSpace = settings.control === 'space';
  const control = CONTROL_LABELS[settings.control];

  container.innerHTML = `
    <div class="screen typing">
      ${appHeader('Digitação', controlPill(settings.control))}

      <div class="toolbar">
        <div class="seg" aria-label="Duração">
          ${DURATIONS.map((d) => `<button data-dur="${d}">${d}s</button>`).join('')}
        </div>
        <div class="seg" aria-label="Dica">
          <button data-hint="off">sem dica</button>
          <button data-hint="on">com dica</button>
        </div>
        <button class="btn ghost small" data-act="again">${ICONS.restart} reiniciar <kbd>esc</kbd></button>
      </div>

      <div class="card stage">
        <div class="stats">
          <div class="stat stat-time"><b class="s-time"></b><span>segundos</span></div>
          <div class="stat"><b class="s-letters">0</b><span>letras</span></div>
          <div class="stat"><b class="s-errors">0</b><span>erros</span></div>
          <div class="stat"><b class="s-phrases">0</b><span>frases</span></div>
        </div>
        <div class="time-bar"><div class="time-fill"></div></div>

        <div class="phrase"></div>

        <div class="keyer">
          <div class="lamp-slot"></div>
          <div class="keyer-target">
            <span class="target-char"></span>
            <span class="code"></span>
          </div>
        </div>
        ${isSpace ? '<div class="meter-slot"></div>' : ''}
        <div class="tape-slot"></div>
        <p class="start-hint">Transmita o primeiro sinal para iniciar o tempo.</p>
      </div>

      <div class="legend-row">${legendHtml(settings.control)}</div>

      <div class="card results hidden"></div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => container.querySelector(sel) as T;
  const screenEl = $('.screen');
  const timeEl = $('.s-time');
  const timeFill = $('.time-fill');
  const phraseEl = $('.phrase');
  const keyerEl = $('.keyer');
  const targetEl = $('.target-char');
  const codeEl = $('.code');
  const resultsEl = $('.results');
  const lamp = new SignalLamp($('.lamp-slot'));
  const tape = new SignalTape($('.tape-slot'), settings.spaceThresholdMs);
  const meter = isSpace ? new HoldMeter($('.meter-slot'), settings.spaceThresholdMs) : null;

  let session: TypingSession;
  let startedAt: number | null = null;
  let finished = false;
  let timerId: number | undefined;

  function blurFocus() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  function stopSignals() {
    beeper.stop();
    lamp.off();
    meter?.end();
    tape.cancelLive();
  }

  function reset() {
    clearInterval(timerId);
    stopSignals();
    input.detach();
    session = new TypingSession(pick);
    startedAt = null;
    finished = false;
    tape.clear();
    resultsEl.classList.add('hidden');
    screenEl.classList.remove('done', 'running');
    container.querySelectorAll<HTMLElement>('[data-dur]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.dur) === settings.duration);
    });
    container.querySelectorAll<HTMLElement>('[data-hint]').forEach((b) => {
      b.classList.toggle('active', (b.dataset.hint === 'on') === settings.showHint);
    });
    input.attach({ onSymbol, onPressStart, onPressEnd });
    blurFocus();
    renderTimer();
    renderPhrase();
    renderCode();
  }

  // ---- eventos dos controles ----
  function onSymbol(sym: MorseSymbol) {
    if (finished) return;
    if (startedAt === null) {
      startedAt = performance.now();
      screenEl.classList.add('running');
      timerId = window.setInterval(tick, 100);
    }
    if (!isSpace) {
      beeper.beep(sym);
      lamp.flash(sym);
    }
    tape.symbol(sym);

    const res = session.input(sym);
    if (res.kind === 'error') {
      beeper.error();
      lamp.error();
      tape.markError();
      keyerEl.classList.remove('shake');
      void keyerEl.offsetWidth; // reinicia a animação
      keyerEl.classList.add('shake');
    } else if (res.kind === 'letter') {
      tape.gap();
    } else if (res.kind === 'phrase') {
      tape.gap(true);
    }
    if (res.kind !== 'progress') renderPhrase();
    renderCode();
  }

  function onPressStart() {
    if (finished) return;
    beeper.start();
    lamp.on();
    meter?.begin();
    tape.pressStart();
  }

  function onPressEnd() {
    beeper.stop();
    lamp.off();
    meter?.end();
  }

  // ---- tempo ----
  function tick() {
    renderTimer();
    if (startedAt !== null && performance.now() - startedAt >= settings.duration * 1000) finish();
  }

  function renderTimer() {
    const elapsed = startedAt === null ? 0 : (performance.now() - startedAt) / 1000;
    timeEl.textContent = String(Math.max(0, Math.ceil(settings.duration - elapsed)));
    timeFill.style.width = `${Math.min(elapsed / settings.duration, 1) * 100}%`;
  }

  // ---- renderização ----
  function renderPhrase() {
    const { phrase, index, errorPositions, stats } = session;
    // Agrupa por palavra para que a quebra de linha aconteça entre palavras.
    let html = '<span class="word">';
    for (let i = 0; i < phrase.length; i++) {
      const c = phrase[i];
      if (c === ' ') {
        html += '</span> <span class="word">';
        continue;
      }
      const state = i < index ? 'done' : i === index ? 'cur' : 'todo';
      html += `<span class="ch ${state} ${errorPositions.has(i) ? 'err' : ''}">${c}</span>`;
    }
    phraseEl.innerHTML = html + '</span>';
    targetEl.textContent = session.currentChar;
    $('.s-letters').textContent = String(stats.letters);
    $('.s-errors').textContent = String(stats.errors);
    $('.s-phrases').textContent = String(stats.phrases);
  }

  function renderCode() {
    const { buffer, expectedCode } = session;
    if (settings.showHint) {
      codeEl.innerHTML = expectedCode
        .split('')
        .map((s, i) => `<span class="${i < buffer.length ? 'typed' : 'ghost'}">${prettyCode(s)}</span>`)
        .join('');
    } else {
      codeEl.innerHTML = buffer
        ? buffer.split('').map((s) => `<span class="typed">${prettyCode(s)}</span>`).join('')
        : '<span class="ghost">?</span>';
    }
  }

  function finish() {
    finished = true;
    clearInterval(timerId);
    stopSignals();
    input.detach();
    const r = computeResults(session.stats, settings.duration * 1000);
    screenEl.classList.add('done');
    screenEl.classList.remove('running');
    const item = (label: string, value: string | number) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
    resultsEl.innerHTML = `
      <div class="results-head">
        <span class="eyebrow">fim da rodada</span>
        <h2>Resultado</h2>
      </div>
      <div class="results-main">
        <div class="ring" style="--p:${r.accuracy}">
          <div><b>${r.accuracy}%</b><small>precisão</small></div>
        </div>
        <div class="headline">
          <div class="big-stat"><b>${r.lpm}</b><span>letras por minuto</span></div>
          <div class="big-stat"><b>${r.wpm}</b><span>palavras por minuto</span></div>
        </div>
      </div>
      <dl class="results-grid">
        ${item('letras', r.letters)}
        ${item('erros', r.errors)}
        ${item('frases', r.phrases)}
        ${item('tempo', `${settings.duration}s`)}
        ${item('controle', control.name)}
        ${item('modo', settings.showHint ? 'com dica' : 'sem dica')}
      </dl>
      <div class="actions">
        <button class="btn primary" data-act="again">${ICONS.restart} jogar de novo <kbd>enter</kbd></button>
        <button class="btn ghost" data-act="menu">voltar ao menu</button>
      </div>`;
    resultsEl.classList.remove('hidden');
    blurFocus();
  }

  // ---- interface ----
  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('button');
    if (!target) return;
    if (target.dataset.dur) {
      ctx.updateSettings({ duration: Number(target.dataset.dur) });
      reset();
    } else if (target.dataset.hint) {
      // Trocar de modo reinicia a rodada, para o resultado valer para um modo só.
      ctx.updateSettings({ showHint: target.dataset.hint === 'on' });
      reset();
    } else if (target.dataset.act === 'again') {
      reset();
    } else if (target.dataset.act === 'menu') {
      ctx.exit();
      return;
    }
    blurFocus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && finished)) {
      e.preventDefault();
      reset();
    }
  };

  container.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  reset();

  return () => {
    clearInterval(timerId);
    stopSignals();
    input.detach();
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
