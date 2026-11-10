import { Beeper } from '../../audio/beeper';
import { MORSE, prettyCode } from '../../morse/alphabet';
import { normalize } from '../../morse/normalize';
import { saveResult } from '../../progress/history';
import { LETRAS_DURATIONS, SPEED_NAMES, speedBand } from '../../shared/results';
import { unitMs } from '../../settings';
import { appHeader, ICONS } from '../../ui/components';
import { focusProgress } from '../../ui/progressScreen';
import { letrasRoundChart } from '../../ui/roundCharts';
import type { GameContext } from '../registry';
import { escutaModeSeg, onModeClick, speedControlHtml, wireSpeedControl } from './mode';
import { LETTERS, LetrasSession, type LetrasAnswer } from './letrasSession';

/** Pausa depois de responder, antes de tocar a próxima letra (ms). */
const PAUSE_OK = 350;
const PAUSE_WRONG = 1100; // mais tempo para ver qual era a letra certa
/** Quantas respostas recentes aparecem na faixa. */
const STRIP_SIZE = 16;

type Phase = 'idle' | 'listening' | 'feedback' | 'done';

export function mountLetrasGame(ctx: GameContext): () => void {
  const { container, settings } = ctx;
  const beeper = new Beeper(settings.sound); // som de erro
  const player = new Beeper(true, 680); // a letra toca sempre, no mesmo tom da palavra secreta

  container.innerHTML = `
    <div class="screen escuta letras">
      ${appHeader('Escuta')}

      <div class="toolbar">
        ${escutaModeSeg('letras')}
        <div class="seg" aria-label="Duração">
          ${LETRAS_DURATIONS.map((d) => `<button data-dur="${d}">${d}s</button>`).join('')}
        </div>
        ${speedControlHtml(settings.escutaWpm)}
        <div class="seg" aria-label="Dica">
          <button data-hint="off">sem dica</button>
          <button data-hint="on">com dica</button>
        </div>
        <span class="toolbar-spacer"></span>
        <button class="btn ghost small" data-act="again">${ICONS.restart} reiniciar <kbd>esc</kbd></button>
      </div>

      <div class="card stage letras-stage">
        <div class="stats">
          <div class="stat stat-time"><b class="s-time"></b><span>segundos</span></div>
          <div class="stat"><b class="s-ok">0</b><span>acertos</span></div>
          <div class="stat"><b class="s-err">0</b><span>erros</span></div>
          <div class="stat"><b class="s-acc">—</b><span>precisão</span></div>
        </div>
        <div class="time-bar"><div class="time-fill"></div></div>

        <div class="listen">
          <button class="play-btn" data-act="play" aria-label="Começar / ouvir de novo">${ICONS.play}</button>
          <div class="answer-box" aria-live="polite"></div>
        </div>
        <p class="start-hint"></p>

        <div class="strip" aria-label="Últimas respostas"></div>
        <div class="letters"></div>
      </div>

      <div class="card results hidden"></div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => container.querySelector(sel) as T;
  const screenEl = $('.screen');
  const timeEl = $('.s-time');
  const timeFill = $('.time-fill');
  const playBtn = $('.play-btn');
  const answerEl = $('.answer-box');
  const hintEl = $('.start-hint');
  const stripEl = $('.strip');
  const lettersEl = $('.letters');
  const resultsEl = $('.results');

  let session: LetrasSession;
  let phase: Phase = 'idle';
  let startedAt = 0;
  let timerId: number | undefined;
  let nextTimer: number | undefined;
  let playTimer: number | undefined;
  let chartCleanup: () => void = () => undefined;
  let last: LetrasAnswer | null = null;

  const duration = () => settings.letrasDuration;
  const band = () => speedBand(settings.escutaWpm);

  function blurFocus() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  // ---- som ----
  function playCurrent() {
    stopPlayback();
    const ms = player.playMorse([MORSE[session.current]], unitMs(settings.escutaWpm));
    if (!ms) return;
    playBtn.classList.add('playing');
    playTimer = window.setTimeout(() => playBtn.classList.remove('playing'), ms);
  }

  function stopPlayback() {
    player.stopMorse();
    clearTimeout(playTimer);
    playBtn.classList.remove('playing');
  }

  // ---- rodada ----
  function reset() {
    chartCleanup();
    chartCleanup = () => undefined;
    clearInterval(timerId);
    clearTimeout(nextTimer);
    stopPlayback();
    session = new LetrasSession();
    phase = 'idle';
    last = null;
    screenEl.classList.remove('running', 'done');
    resultsEl.classList.add('hidden');
    playBtn.innerHTML = ICONS.play;
    hintEl.innerHTML = 'Aperte <kbd>espaço</kbd> ou ▶ para começar. Depois, digite a letra que ouvir.';
    container.querySelectorAll<HTMLElement>('[data-dur]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.dur) === duration());
    });
    container.querySelectorAll<HTMLElement>('[data-hint]').forEach((b) => {
      b.classList.toggle('active', (b.dataset.hint === 'on') === settings.letrasHint);
    });
    renderAll();
    blurFocus();
  }

  function start() {
    phase = 'listening';
    startedAt = performance.now();
    screenEl.classList.add('running');
    playBtn.innerHTML = ICONS.headphones;
    hintEl.innerHTML = '<kbd>espaço</kbd> toca a letra de novo';
    timerId = window.setInterval(tick, 100);
    playCurrent();
    renderAll();
  }

  function answer(letter: string) {
    if (phase !== 'listening') return;
    stopPlayback();
    last = session.answer(letter);
    if (!last.ok) beeper.error();
    phase = 'feedback';
    renderAll();
    nextTimer = window.setTimeout(() => {
      if (phase !== 'feedback') return;
      phase = 'listening';
      last = null;
      renderAll();
      playCurrent();
    }, last.ok ? PAUSE_OK : PAUSE_WRONG);
  }

  function tick() {
    renderTimer();
    if (performance.now() - startedAt >= duration() * 1000) finish();
  }

  function finish() {
    phase = 'done';
    clearInterval(timerId);
    clearTimeout(nextTimer);
    stopPlayback();
    screenEl.classList.remove('running');
    screenEl.classList.add('done');
    showResults();
  }

  // ---- renderização ----
  function renderAll() {
    renderTimer();
    renderStats();
    renderAnswer();
    renderStrip();
    renderKeys();
  }

  function renderTimer() {
    const elapsed = phase === 'idle' ? 0 : (performance.now() - startedAt) / 1000;
    timeEl.textContent = String(Math.max(0, Math.ceil(duration() - elapsed)));
    timeFill.style.width = `${Math.min(elapsed / duration(), 1) * 100}%`;
  }

  function renderStats() {
    $('.s-ok').textContent = String(session.correct);
    $('.s-err').textContent = String(session.errors);
    $('.s-acc').textContent = session.answers.length ? `${session.accuracy}%` : '—';
  }

  function renderAnswer() {
    if (phase === 'idle') {
      answerEl.className = 'answer-box';
      answerEl.innerHTML = '<span class="answer-letter ghost">?</span>';
    } else if (last) {
      answerEl.className = `answer-box ${last.ok ? 'ok' : 'wrong'}`;
      answerEl.innerHTML = last.ok
        ? `<span class="answer-letter">${last.letter}</span><span class="answer-code">${prettyCode(MORSE[last.letter])}</span>`
        : `<span class="answer-letter"><s>${last.typed}</s> ${last.letter}</span><span class="answer-code">era ${last.letter} · ${prettyCode(MORSE[last.letter])}</span>`;
    } else {
      answerEl.className = 'answer-box waiting';
      answerEl.innerHTML = '<span class="answer-letter ghost">?</span><span class="answer-code">qual letra?</span>';
    }
  }

  function renderStrip() {
    const recent = session.answers.slice(-STRIP_SIZE);
    stripEl.innerHTML = recent.length
      ? recent
          .map((a) =>
            a.ok
              ? `<span class="chip ok" title="${a.letter}: acertou">${a.letter}</span>`
              : `<span class="chip wrong" title="${a.letter}: você digitou ${a.typed}">${a.letter}</span>`,
          )
          .join('')
      : '';
  }

  function renderKeys() {
    lettersEl.innerHTML = LETTERS.split('')
      .map((c) => {
        let cls = '';
        if (last?.letter === c) cls = 'correct';
        else if (last && !last.ok && last.typed === c) cls = 'wrong';
        const code = settings.letrasHint ? `<span>${prettyCode(MORSE[c])}</span>` : '';
        return `<button class="key ${cls}" data-letter="${c}"><b>${c}</b>${code}</button>`;
      })
      .join('');
    lettersEl.classList.toggle('no-hint', !settings.letrasHint);
  }

  function showResults() {
    const lpm = Math.round((session.correct / duration()) * 60);
    const speedName = SPEED_NAMES[band()];
    const hintName = settings.letrasHint ? 'com dica' : 'sem dica';
    const combo = `${speedName} · ${hintName} · ${duration()}s`;
    const missed = new Map<string, number>();
    for (const c of session.missed) missed.set(c, (missed.get(c) ?? 0) + 1);
    const item = (label: string, value: string | number) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

    resultsEl.innerHTML = `
      <div class="results-head">
        <span class="eyebrow">fim da rodada</span>
        <h2>Resultado</h2>
      </div>
      <div class="results-main">
        <div class="ring" style="--p:${session.accuracy}">
          <div><b>${session.accuracy}%</b><small>precisão</small></div>
        </div>
        <div class="headline">
          <div class="big-stat"><b>${session.correct}</b><span>letras certas</span></div>
          <div class="big-stat"><b>${lpm}</b><span>acertos por minuto</span></div>
        </div>
      </div>
      <dl class="results-grid">
        ${item('acertos', session.correct)}
        ${item('erros', session.errors)}
        ${item('tempo', `${duration()}s`)}
        ${item('velocidade', `${speedName} · ${settings.escutaWpm} ppm`)}
        ${item('modo', hintName)}
      </dl>
      ${
        missed.size
          ? `<div class="missed">
              <span class="missed-label">Para treinar</span>
              ${[...missed]
                .sort((a, b) => b[1] - a[1])
                .map(([c, n]) => `<span class="missed-item"><b>${c}</b>${prettyCode(MORSE[c])}${n > 1 ? `<small>×${n}</small>` : ''}</span>`)
                .join('')}
            </div>`
          : ''
      }
      <p class="save-note"></p>
      <div class="round-chart hidden"></div>
      <div class="actions">
        <button class="btn primary" data-act="again">${ICONS.restart} jogar de novo <kbd>enter</kbd></button>
        <button class="btn ghost" data-act="menu">voltar ao menu</button>
      </div>`;
    resultsEl.classList.remove('hidden');
    blurFocus();
    save(combo);
  }

  /** Salva a rodada no navegador, diz se foi recorde na mesma combinação e mostra o gráfico dela. */
  function save(combo: string) {
    const note = $('.save-note');
    const saved = saveResult({
      game: 'letras',
      speed: band(),
      wpm: settings.escutaWpm,
      duration: duration(),
      hint: settings.letrasHint,
      data: { correct: session.correct, errors: session.errors, accuracy: session.accuracy, missed: session.missed },
    });
    if (!saved.stored) {
      note.textContent = 'Não foi possível salvar esta rodada neste navegador.';
      note.className = 'save-note error';
      return;
    }
    if (saved.isRecord) {
      note.className = 'save-note record';
      note.textContent =
        saved.previousBest == null
          ? `Primeiro recorde em ${combo}!`
          : `Novo recorde em ${combo}! Antes: ${saved.previousBest} acertos.`;
    } else if (saved.previousBest == null) {
      note.textContent = 'Rodada salva.';
    } else {
      note.innerHTML = `Seu recorde em ${combo}: <b>${saved.previousBest} acertos</b>`;
    }
    note.insertAdjacentHTML('beforeend', ` · <a href="#progresso" data-progress>ver progresso</a>`);

    const chartEl = $('.round-chart');
    chartEl.classList.remove('hidden');
    chartCleanup = letrasRoundChart(chartEl, {
      speed: band(),
      duration: duration(),
      hint: settings.letrasHint,
      name: combo,
    });
  }

  // ---- interface ----
  const onClick = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-progress]')) {
      focusProgress({ game: 'letras', speed: band(), duration: duration(), hint: settings.letrasHint });
      return; // o link segue para #progresso
    }
    if (onModeClick(el)) return;
    const btn = el.closest<HTMLElement>('button');
    if (!btn) return;
    const { act, dur, hint, letter } = btn.dataset;
    if (act === 'menu') {
      ctx.exit();
      return;
    }
    // Trocar a configuração reinicia, para o resultado valer para uma combinação só.
    if (dur) {
      ctx.updateSettings({ letrasDuration: Number(dur) });
      reset();
    } else if (hint) {
      ctx.updateSettings({ letrasHint: hint === 'on' });
      reset();
    } else if (act === 'again') reset();
    else if (act === 'play') {
      if (phase === 'idle') start();
      else if (phase === 'listening') playCurrent();
    } else if (letter) {
      if (phase === 'idle') start();
      else answer(letter);
    }
    blurFocus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && phase === 'done')) {
      e.preventDefault();
      reset();
    } else if (e.key === ' ' || (e.key === 'Enter' && phase === 'idle')) {
      e.preventDefault();
      if (e.repeat) return;
      if (phase === 'idle') start();
      else if (phase === 'listening') playCurrent();
    } else if (e.key.length === 1 && phase !== 'done') {
      // Aceita letras com acento (ç → C, á → A).
      const letter = normalize(e.key);
      if (!/^[A-Z]$/.test(letter)) return;
      e.preventDefault();
      if (phase === 'idle') start();
      else answer(letter);
    }
  };

  // Mudou a velocidade: reinicia (o resultado vale para uma velocidade só) e toca uma letra de exemplo.
  wireSpeedControl(container, (wpm) => {
    ctx.updateSettings({ escutaWpm: wpm });
    reset();
    player.playMorse([MORSE[session.current]], unitMs(wpm));
  });

  container.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  reset();

  return () => {
    chartCleanup();
    clearInterval(timerId);
    clearTimeout(nextTimer);
    stopPlayback();
    beeper.stop();
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
