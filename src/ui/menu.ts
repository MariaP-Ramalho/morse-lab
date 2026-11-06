import { GAMES, type GameDef } from '../games/registry';
import { MORSE, prettyCode } from '../morse/alphabet';
import type { Settings } from '../settings';
import { appHeader, ICONS, SignalLamp } from './components';
import { controlPicker } from './controlPicker';

interface MenuOptions {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  onPlay: (game: GameDef) => void;
}

const HERO_WORD = 'MORSE';
const UNIT = 110; // ms de uma unidade Morse na animação

export function mountMenu(container: HTMLElement, opts: MenuOptions): () => void {
  const { settings } = opts;

  const modeCard = (g: GameDef) => `
    <button class="mode-card" data-game="${g.id}">
      <span class="mode-top">
        <span class="mode-icon">${g.icon}</span>
        <span class="mode-tag ${g.kind}">${g.kind === 'game' ? 'jogo' : 'ferramenta'}</span>
      </span>
      <span class="mode-name">${g.name}</span>
      <span class="mode-desc">${g.description}</span>
      <span class="mode-go">abrir ${ICONS.arrowRight}</span>
    </button>`;

  const tableGroup = (title: string, chars: string) => `
    <div class="ref-group">
      <h3>${title}</h3>
      <div class="ref-grid">
        ${chars
          .split('')
          .map((c) => `<div class="ref"><b>${c}</b><span>${prettyCode(MORSE[c])}</span></div>`)
          .join('')}
      </div>
    </div>`;

  container.innerHTML = `
    <div class="screen menu">
      ${appHeader()}

      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">treino de código morse</span>
          <h1>Fale com <em>pontos</em> e <em>traços</em>.</h1>
          <p>Escolha como quer transmitir e um modo para praticar. Todos os modos funcionam com os três controles.</p>
          <div class="hero-actions">
            <button class="btn primary" data-game="${GAMES[0].id}">Começar ${ICONS.arrowRight}</button>
            <span class="hint-text"><kbd>enter</kbd> para começar</span>
            <a class="btn ghost" href="#progresso">${ICONS.chart} meu progresso</a>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-lamp"></div>
          <div class="hero-word">
            ${HERO_WORD.split('')
              .map(
                (c, i) => `
              <div class="hero-letter" data-i="${i}">
                <b>${c}</b>
                <span>${MORSE[c].split('').map((s) => `<i class="${s === '.' ? 'dot' : 'dash'}"></i>`).join('')}</span>
              </div>`,
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <span class="step">01</span>
          <div><h2>Controle</h2><p>Como você vai enviar os sinais.</p></div>
        </div>
        <div class="slot-picker"></div>
        <div class="threshold ${settings.control === 'space' ? '' : 'hidden'}">
          <div>
            <b>Limite ponto / traço</b>
            <small>Segurar menos que isso é ponto; mais é traço.</small>
          </div>
          <input type="range" min="100" max="450" step="10" value="${settings.spaceThresholdMs}" />
          <span class="value thr-value">${settings.spaceThresholdMs} ms</span>
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <span class="step">02</span>
          <div><h2>Modo</h2><p>Jogos para treinar e ferramentas para usar.</p></div>
        </div>
        <div class="mode-grid">${GAMES.map(modeCard).join('')}</div>
      </section>

      <section class="block">
        <div class="block-head">
          <span class="step">03</span>
          <div><h2>Preferências</h2><p>Valem para todos os modos.</p></div>
        </div>
        <div class="prefs">
          <div class="pref">
            <span class="pref-icon">${ICONS.sound}</span>
            <div class="pref-text"><b>Som</b><small>Bipe a cada ponto e traço</small></div>
            <button class="switch ${settings.sound ? 'on' : ''}" data-opt="sound" aria-label="Som"><span></span></button>
          </div>
          <div class="pref">
            <span class="pref-icon">${ICONS.eye}</span>
            <div class="pref-text"><b>Dica na digitação</b><small>Mostrar o código da letra atual</small></div>
            <div class="seg">
              <button class="${settings.showHint ? '' : 'active'}" data-hint="off">sem dica</button>
              <button class="${settings.showHint ? 'active' : ''}" data-hint="on">com dica</button>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <details class="reference">
          <summary>
            <span class="step">?</span>
            <div><h2>Tabela de referência</h2><p>Todas as letras, números e sinais.</p></div>
          </summary>
          ${tableGroup('Letras', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')}
          ${tableGroup('Números', '0123456789')}
          ${tableGroup('Pontuação', '.,?!')}
        </details>
      </section>
    </div>`;

  // ---- seletor de controle ----
  const thresholdEl = container.querySelector<HTMLElement>('.threshold')!;
  container.querySelector('.slot-picker')!.replaceWith(
    controlPicker(settings.control, (mode) => {
      opts.updateSettings({ control: mode });
      thresholdEl.classList.toggle('hidden', mode !== 'space');
    }),
  );

  const range = thresholdEl.querySelector<HTMLInputElement>('input')!;
  range.addEventListener('input', () => {
    opts.updateSettings({ spaceThresholdMs: Number(range.value) });
    container.querySelector('.thr-value')!.textContent = `${range.value} ms`;
  });

  // ---- animação do herói: a lâmpada transmite "MORSE" em loop ----
  const lamp = new SignalLamp(container.querySelector('.hero-lamp')!);
  const letters = [...container.querySelectorAll<HTMLElement>('.hero-letter')];
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  function playHero() {
    let t = 400;
    HERO_WORD.split('').forEach((c, li) => {
      const symbols = letters[li].querySelectorAll('i');
      MORSE[c].split('').forEach((s, si) => {
        const dur = s === '.' ? UNIT : UNIT * 3;
        at(t, () => {
          letters.forEach((l, k) => l.classList.toggle('playing', k === li));
          symbols[si].classList.add('lit');
          lamp.on();
        });
        at(t + dur, () => lamp.off());
        t += dur + UNIT;
      });
      t += UNIT * 2;
    });
    at(t + 200, () => {
      letters.forEach((l) => {
        l.classList.remove('playing');
        l.querySelectorAll('i').forEach((i) => i.classList.remove('lit'));
      });
    });
    at(t + 1800, playHero);
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) playHero();

  // ---- cliques ----
  const onClick = (e: MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-opt="sound"]')) {
      opts.updateSettings({ sound: !settings.sound });
      container.querySelector('[data-opt="sound"]')!.classList.toggle('on', settings.sound);
    }
    const hint = el.closest<HTMLElement>('[data-hint]');
    if (hint) {
      opts.updateSettings({ showHint: hint.dataset.hint === 'on' });
      container.querySelectorAll<HTMLElement>('[data-hint]').forEach((b) => {
        b.classList.toggle('active', b === hint);
      });
    }
    const game = el.closest<HTMLElement>('[data-game]');
    if (game) {
      const def = GAMES.find((g) => g.id === game.dataset.game);
      if (def) opts.onPlay(def);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    // Enter num botão já dispara o clique dele.
    if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) {
      e.preventDefault();
      opts.onPlay(GAMES[0]);
    }
  };

  container.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);

  return () => {
    timers.forEach((t) => clearTimeout(t));
    container.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey);
    container.innerHTML = '';
  };
}
