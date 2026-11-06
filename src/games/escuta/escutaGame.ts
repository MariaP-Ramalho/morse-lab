import { saveResult } from '../../progress/history';
import { Beeper } from '../../audio/beeper';
import { MORSE, prettyCode } from '../../morse/alphabet';
import { normalize } from '../../morse/normalize';
import { SPEED_UNIT_MS, type EscutaSpeed } from '../../settings';
import { appHeader, ICONS } from '../../ui/components';
import { focusProgress } from '../../ui/progressScreen';
import { escutaRoundChart } from '../../ui/roundCharts';
import type { GameContext } from '../registry';
import { EscutaSession, MAX_ATTEMPTS, type TileState } from './session';
import { wordPicker } from './words.pt';

const SPEEDS: [EscutaSpeed, string][] = [
  ['slow', 'lenta'],
  ['normal', 'normal'],
  ['fast', 'rápida'],
];

const STATE_LABEL: Record<TileState, string> = {
  correct: 'lugar certo',
  present: 'em outro lugar',
  absent: 'não tem',
};

const pick = wordPicker();

type SaveState = 'saved' | 'failed';
const SAVE_NOTE: Record<SaveState, string> = {
  saved: '<a href="#progresso" data-progress>ver progresso</a>',
  failed: 'Não foi possível salvar este jogo neste navegador.',
};

export function mountEscutaGame(ctx: GameContext): () => void {
  const { container, settings } = ctx;
  const beeper = new Beeper(settings.sound); // som de erro
  const player = new Beeper(true, 680); // a palavra secreta toca sempre, em outro tom

  container.innerHTML = `
    <div class="screen escuta">
      ${appHeader('Escuta')}

      <div class="toolbar">
        <div class="seg" aria-label="Velocidade">
          ${SPEEDS.map(([s, label]) => `<button data-speed="${s}">${label}</button>`).join('')}
        </div>
        <span class="toolbar-spacer"></span>
        <button class="btn ghost small" data-act="new">${ICONS.restart} nova palavra</button>
      </div>

      <div class="escuta-grid">
        <div class="card board-card">
          <div class="board"></div>
          <div class="message" aria-live="polite"></div>
        </div>

        <div class="side">
          <div class="card player">
            <button class="play-btn" data-act="play" aria-label="Ouvir a palavra">${ICONS.play}</button>
            <div class="player-text">
              <b>Ouvir a palavra</b>
              <small><span class="len"></span> letras · <kbd>espaço</kbd> repete</small>
            </div>
            <div class="play-progress"><div class="play-fill"></div></div>
          </div>

          <div class="card letters-card">
            <div class="card-label">Letras</div>
            <div class="letters"></div>
            <div class="letters-actions">
              <button class="btn ghost small" data-act="erase">⌫ apagar</button>
              <button class="btn primary small" data-act="enter">enviar <kbd>enter</kbd></button>
            </div>
            <div class="letters-legend">
              ${(['correct', 'present', 'absent'] as TileState[])
                .map((s) => `<span><i class="swatch ${s}"></i>${STATE_LABEL[s]}</span>`)
                .join('')}
            </div>
            <ul class="legend escuta-legend">
              <li><span class="legend-keys"><kbd>A</kbd>–<kbd>Z</kbd></span><span class="legend-action">digitar letra</span></li>
              <li><span class="legend-keys"><kbd>backspace</kbd></span><span class="legend-action">apagar</span></li>
              <li><span class="legend-keys"><kbd>enter</kbd></span><span class="legend-action">enviar palavra</span></li>
              <li><span class="legend-keys"><kbd>espaço</kbd></span><span class="legend-action">ouvir de novo</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => container.querySelector(sel) as T;
  const boardEl = $('.board');
  const messageEl = $('.message');
  const lettersEl = $('.letters');
  const playBtn = $('.play-btn');
  const playFill = $('.play-fill');

  let session: EscutaSession;
  let revealRow = -1; // linha que acabou de ser enviada (anima uma vez)
  let playTimer: number | undefined;
  let playRaf: number | undefined;
  let messageTimer: number | undefined;
  let chartCleanup: () => void = () => undefined;
  let disposed = false;
  /** Velocidade em que o último jogo terminado foi salvo (o usuário pode trocar na tela final). */
  let endedSpeed: EscutaSpeed = settings.escutaSpeed;

  function blurFocus() {
    (document.activeElement as HTMLElement | null)?.blur();
  }

  // ---- reprodução da palavra ----
  function play(auto = false) {
    stopPlayback();
    // Sem nenhum clique/tecla na página, o navegador não deixa tocar som sozinho.
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (auto && activation && !activation.hasBeenActive) {
      playBtn.classList.add('attention');
      flash('Aperte ▶ ou espaço para ouvir a palavra.');
      return;
    }
    playBtn.classList.remove('attention');
    const codes = session.answer.split('').map((c) => MORSE[c]);
    const duration = player.playMorse(codes, SPEED_UNIT_MS[settings.escutaSpeed]);
    if (!duration) return;
    playBtn.classList.add('playing');
    playBtn.innerHTML = ICONS.stop;
    const start = performance.now();
    const loop = () => {
      const p = Math.min((performance.now() - start) / duration, 1);
      playFill.style.width = `${p * 100}%`;
      if (p < 1) playRaf = requestAnimationFrame(loop);
    };
    loop();
    playTimer = window.setTimeout(stopPlayback, duration);
  }

  function stopPlayback() {
    player.stopMorse();
    clearTimeout(playTimer);
    if (playRaf) cancelAnimationFrame(playRaf);
    playBtn.classList.remove('playing');
    playBtn.innerHTML = ICONS.play;
    playFill.style.width = '0%';
  }

  function togglePlay() {
    if (playBtn.classList.contains('playing')) stopPlayback();
    else play();
  }

  // ---- rodada ----
  function newGame() {
    stopPlayback();
    chartCleanup();
    chartCleanup = () => undefined;
    session = new EscutaSession(pick());
    revealRow = -1;
    messageEl.innerHTML = '';
    messageEl.className = 'message';
    $('.len').textContent = String(session.length);
    container.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => {
      b.classList.toggle('active', b.dataset.speed === settings.escutaSpeed);
    });
    render();
    blurFocus();
    window.setTimeout(() => play(true), 350);
  }

  function flash(text: string, shake = false) {
    clearTimeout(messageTimer);
    messageEl.className = 'message note';
    messageEl.textContent = text;
    if (shake) {
      const row = boardEl.querySelector('.row.current');
      row?.classList.remove('shake');
      void (row as HTMLElement | null)?.offsetWidth;
      row?.classList.add('shake');
    }
    messageTimer = window.setTimeout(() => {
      if (session.status === 'playing') messageEl.textContent = '';
    }, 1800);
  }

  function afterSubmit() {
    revealRow = session.rows.length - 1;
    render();
    if (session.status !== 'playing') {
      const won = session.status === 'won';
      const finished = session;
      endedSpeed = settings.escutaSpeed;
      const saved = saveResult({
        game: 'escuta',
        speed: endedSpeed,
        data: { won, attempts: session.rows.length, word: session.answer },
      });
      const st = saved.summary!;
      // Espera a animação das peças antes de mostrar o resultado.
      window.setTimeout(() => {
        if (!disposed && session === finished) showEnd(won, st.wins, st.played, st.streak, saved.stored ? 'saved' : 'failed');
      }, session.length * 120 + 350);
    }
  }

  function showEnd(won: boolean, wins: number, played: number, streak: number, save: SaveState) {
    clearTimeout(messageTimer);
    const code = session.answer
      .split('')
      .map((c) => prettyCode(MORSE[c]))
      .join('  ');
    messageEl.className = `message end ${won ? 'won' : 'lost'}`;
    messageEl.innerHTML = `
      <div class="end-title">${
        won
          ? `Acertou em ${session.rows.length}/${MAX_ATTEMPTS}!`
          : `A palavra era <b>${session.answer}</b>`
      }</div>
      <div class="end-code">${code}</div>
      <div class="end-stats">
        <span><b>${played}</b> ${played === 1 ? 'jogo' : 'jogos'}</span>
        <span><b>${played ? Math.round((wins / played) * 100) : 0}%</b> vitórias</span>
        <span><b>${streak}</b> seguidas</span>
      </div>
      <p class="save-note">${SAVE_NOTE[save]}</p>
      ${save === 'saved' ? '<div class="round-chart"></div>' : ''}
      <div class="actions">
        <button class="btn primary" data-act="new">${ICONS.restart} nova palavra <kbd>enter</kbd></button>
        <button class="btn ghost" data-act="play">${ICONS.headphones} ouvir de novo</button>
      </div>`;
    if (save === 'saved') {
      chartCleanup = escutaRoundChart($('.round-chart'), {
        speed: endedSpeed,
        speedName: SPEEDS.find(([s]) => s === endedSpeed)![1],
        won,
        attempts: session.rows.length,
      });
    }
  }

  // ---- renderização ----
  function tile(letter: string, state: string, extra = '', delay?: number) {
    const style = delay !== undefined ? ` style="animation-delay:${delay}ms"` : '';
    const code = letter && MORSE[letter] ? prettyCode(MORSE[letter]) : '';
    return `<div class="tile ${state} ${extra}"${style}><span class="tile-letter">${letter}</span><span class="tile-code">${code}</span></div>`;
  }

  function render() {
    const len = session.length;
    let html = '';
    for (let r = 0; r < MAX_ATTEMPTS; r++) {
      const done = session.rows[r];
      if (done) {
        const reveal = r === revealRow;
        html += `<div class="row">${done.word
          .split('')
          .map((c, i) => tile(c, done.states[i], reveal ? 'reveal' : '', reveal ? i * 120 : undefined))
          .join('')}</div>`;
      } else if (r === session.rows.length && session.status === 'playing') {
        let tiles = '';
        for (let i = 0; i < len; i++) {
          const c = session.current[i] ?? '';
          if (c) tiles += tile(c, 'filled');
          else tiles += tile('', i === session.current.length ? 'active' : 'empty');
        }
        html += `<div class="row current">${tiles}</div>`;
      } else {
        html += `<div class="row">${Array.from({ length: len }, () => tile('', 'empty')).join('')}</div>`;
      }
    }
    boardEl.innerHTML = html;
    revealRow = -1;
    renderLetters();
  }

  function renderLetters() {
    lettersEl.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      .split('')
      .map(
        (c) =>
          `<button class="key ${session.letterStates[c] ?? ''}" data-letter="${c}"><b>${c}</b><span>${prettyCode(MORSE[c])}</span></button>`,
      )
      .join('');
  }

  // ---- digitação ----
  function typeLetter(letter: string) {
    if (session.status !== 'playing') return;
    if (session.type(letter) === 'full') {
      flash('A linha está cheia: envie ou apague.', true);
      return;
    }
    render();
  }

  function erase() {
    session.backspace();
    render();
  }

  function submit() {
    if (session.status !== 'playing') return newGame();
    const res = session.enter();
    if (res === 'submitted') afterSubmit();
    else if (res === 'incomplete') {
      beeper.error();
      flash(`A palavra tem ${session.length} letras.`, true);
    }
  }

  // ---- interface ----
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-progress]')) {
      focusProgress({ game: 'escuta', speed: endedSpeed });
      return; // o link segue para #progresso
    }
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn) return;
    if (btn.dataset.act === 'menu') {
      ctx.exit();
      return;
    }
    if (btn.dataset.letter) typeLetter(btn.dataset.letter);
    else if (btn.dataset.act === 'erase') erase();
    else if (btn.dataset.act === 'enter') submit();
    else if (btn.dataset.act === 'play') togglePlay();
    else if (btn.dataset.act === 'new') newGame();
    else if (btn.dataset.speed) {
      ctx.updateSettings({ escutaSpeed: btn.dataset.speed as EscutaSpeed });
      container.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.classList.toggle('active', b === btn));
      play();
    }
    blurFocus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === ' ')) return;
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (e.key.length === 1) {
      // Aceita letras com acento (ç → C, á → A).
      const letter = normalize(e.key);
      if (/^[A-Z]$/.test(letter)) {
        e.preventDefault();
        typeLetter(letter);
      }
    }
  };

  container.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  newGame();

  return () => {
    disposed = true;
    stopPlayback();
    chartCleanup();
    chartCleanup = () => undefined;
    clearTimeout(messageTimer);
    beeper.stop();
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
