import { loadResults } from '../progress/history';
import { CONTROL_LABELS } from '../input/types';
import {
  attemptsDistribution,
  bySpeed,
  escutaOnly,
  escutaSummary,
  filterEscuta,
  filterTyping,
  recordsGrid,
  runningBest,
  typingOnly,
  typingSummary,
  type TypingFilter,
} from '../progress/stats';
import {
  CONTROLS,
  ESCUTA_SPEEDS,
  TYPING_DURATIONS,
  type Control,
  type EscutaResult,
  type Speed,
  type StoredResult,
  type TypingResult,
} from '../shared/results';
import { columnChart, lineChart } from './charts';
import { appHeader, CONTROL_ICONS, ICONS } from './components';

type Game = 'typing' | 'escuta';

const SPEED_NAMES: Record<Speed, string> = { slow: 'lenta', normal: 'normal', fast: 'rápida' };
const HINT_NAMES = { off: 'sem dica', on: 'com dica' } as const;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function fmtDuration(totalS: number): string {
  if (totalS < 60) return `${totalS}s`;
  const m = Math.round(totalS / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}min`;
}

const comboName = (r: TypingResult) =>
  `${CONTROL_LABELS[r.control].name} · ${r.hint ? 'com dica' : 'sem dica'} · ${r.duration}s`;

/** Filtros guardados durante a sessão do navegador (voltar à tela mantém a escolha). */
const state: { game: Game; typing: TypingFilter; speed: Speed | 'all' } = {
  game: 'typing',
  typing: { control: 'all', hint: 'all', duration: 'all' },
  speed: 'all',
};

/** Abre o Progresso já filtrado na configuração de uma partida (usado pelo "ver progresso" dos jogos). */
export function focusProgress(
  f: { game: 'typing'; control: Control; hint: boolean; duration: number } | { game: 'escuta'; speed: Speed },
): void {
  state.game = f.game;
  if (f.game === 'typing') state.typing = { control: f.control, hint: f.hint ? 'on' : 'off', duration: f.duration };
  else state.speed = f.speed;
}

export function mountProgressScreen(container: HTMLElement): () => void {
  const results: StoredResult[] = loadResults();
  let cleanups: (() => void)[] = [];

  container.innerHTML = `
    <div class="screen progress">
      ${appHeader('Progresso')}
      <div class="progress-body"></div>
    </div>`;
  const body = container.querySelector<HTMLElement>('.progress-body')!;
  const onMenu = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-act="menu"]')) location.hash = '';
  };
  container.addEventListener('click', onMenu);

  // ---- filtros ----
  const seg = (name: string, options: [string, string][], current: string) => `
    <div class="seg" role="group" aria-label="${name}">
      ${options.map(([v, label]) => `<button data-f="${name}" data-v="${v}" class="${v === current ? 'active' : ''}">${label}</button>`).join('')}
    </div>`;

  function filtersHtml() {
    const games = seg('jogo', [['typing', 'Digitação'], ['escuta', 'Escuta']], state.game);
    if (state.game === 'escuta') {
      return `${games}${seg('velocidade', [['all', 'todas'], ...ESCUTA_SPEEDS.map((s) => [s, SPEED_NAMES[s]] as [string, string])], state.speed)}`;
    }
    const f = state.typing;
    return `${games}
      ${seg('controle', [['all', 'todos'], ...CONTROLS.map((c) => [c, CONTROL_LABELS[c].name] as [string, string])], f.control)}
      ${seg('dica', [['all', 'todas'], ['off', 'sem dica'], ['on', 'com dica']], f.hint)}
      ${seg('tempo', [['all', 'todos'], ...TYPING_DURATIONS.map((d) => [String(d), `${d}s`] as [string, string])], String(f.duration))}`;
  }

  function render() {
    cleanups.forEach((c) => c());
    cleanups = [];
    body.innerHTML = `
      <div class="progress-head">
        <span class="eyebrow">salvo neste navegador</span>
        <h1>Seu progresso</h1>
      </div>
      <div class="filters">${filtersHtml()}</div>
      <div class="progress-content"></div>`;
    const content = body.querySelector<HTMLElement>('.progress-content')!;
    if (state.game === 'typing') renderTyping(content);
    else renderEscuta(content);
  }

  const tile = (label: string, value: string, sub = '') =>
    `<div class="card tile-stat"><span class="tile-label">${label}</span><b class="tile-value">${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;

  const emptyHtml = (msg: string) => `<div class="card empty-card"><p>${msg}</p></div>`;

  // ---- digitação ----
  function renderTyping(content: HTMLElement) {
    const all = typingOnly(results);
    const list = filterTyping(all, state.typing);
    if (!all.length) {
      content.innerHTML = emptyHtml('Nenhuma rodada de Digitação ainda. Jogue uma e volte aqui!') +
        `<div class="center"><a class="btn primary" href="#typing">${ICONS.timer} jogar Digitação</a></div>`;
      return;
    }
    const s = typingSummary(list);
    const byDuration = filterTyping(all, { control: 'all', hint: 'all', duration: state.typing.duration });
    const grid = recordsGrid(byDuration);
    const f = state.typing;

    content.innerHTML = `
      <div class="tiles">
        ${tile('Recorde', s.best ? `${s.best.data.lpm} <span>LPM</span>` : '—', s.best ? `${comboName(s.best)} · ${fmtDay(s.best.createdAt)}` : '')}
        ${tile('Melhor WPM', s.rounds ? String(s.bestWpm) : '—', 'palavras por minuto')}
        ${tile('Precisão média', s.rounds ? `${s.avgAccuracy}%` : '—', s.rounds ? `média de ${s.avgLpm} LPM` : '')}
        ${tile('Rodadas', String(s.rounds), s.rounds ? `${fmtDuration(s.totalSeconds)} · ${s.totalLetters} letras` : '')}
      </div>

      <div class="card chart-card">
        <div class="card-head">
          <div><h2>Letras por minuto</h2><p>Cada rodada no filtro atual, da mais antiga para a mais recente.</p></div>
        </div>
        <div class="chart-slot"></div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>Recordes por controle e dica</h2>
            <p>Melhor LPM em cada combinação${f.duration === 'all' ? ', em todas as durações' : ` nas rodadas de ${f.duration}s`}.</p>
          </div>
        </div>
        <div class="table-scroll">
          <table class="records">
            <thead><tr><th>controle</th><th>sem dica</th><th>com dica</th></tr></thead>
            <tbody>
              ${CONTROLS.map((c) => `
                <tr>
                  <th scope="row"><span class="ctrl">${CONTROL_ICONS[c]}${CONTROL_LABELS[c].name}</span></th>
                  ${[false, true].map((h) => recordCell(grid.find((g) => g.control === c && g.hint === h)!, c, h)).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Últimas rodadas</h2><p>As 15 mais recentes no filtro atual.</p></div></div>
        <div class="table-scroll">${typingHistory(list)}</div>
      </div>`;

    const slot = content.querySelector<HTMLElement>('.chart-slot')!;
    if (!list.length) {
      slot.innerHTML = '<p class="chart-empty">Nenhuma rodada com esses filtros.</p>';
      return;
    }
    const lpm = list.map((r) => r.data.lpm);
    cleanups.push(
      lineChart(
        slot,
        {
          labels: list.map((r) => `${fmtDate(r.createdAt)} · ${comboName(r)}`),
          unit: 'LPM',
          series: [
            { name: 'rodada', color: 'var(--viz-1)', values: lpm },
            { name: 'recorde', color: 'var(--viz-2)', values: runningBest(lpm), step: true, endLabel: true },
          ],
        },
        `Letras por minuto em ${list.length} rodadas. Recorde: ${s.best?.data.lpm ?? 0} LPM.`,
      ),
    );
  }

  function recordCell(cell: ReturnType<typeof recordsGrid>[number], control: Control, hint: boolean) {
    const f = state.typing;
    const inFilter = (f.control === 'all' || f.control === control) && (f.hint === 'all' || (f.hint === 'on') === hint);
    const cls = inFilter ? '' : 'dim';
    if (cell.bestLpm === null) return `<td class="${cls}"><span class="muted">—</span></td>`;
    return `<td class="${cls}"><b>${cell.bestLpm}</b> <span class="unit">LPM</span><small>${cell.rounds} ${cell.rounds === 1 ? 'rodada' : 'rodadas'} · ${cell.avgAccuracy}% precisão</small></td>`;
  }

  function typingHistory(list: TypingResult[]) {
    if (!list.length) return '<p class="chart-empty">Nenhuma rodada com esses filtros.</p>';
    const rows = list.slice(-15).reverse();
    return `
      <table class="history">
        <thead><tr><th>quando</th><th>controle</th><th>dica</th><th>tempo</th><th class="num">LPM</th><th class="num">WPM</th><th class="num">precisão</th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td>${fmtDate(r.createdAt)}</td>
            <td>${CONTROL_LABELS[r.control].name}</td>
            <td>${r.hint ? HINT_NAMES.on : HINT_NAMES.off}</td>
            <td>${r.duration}s</td>
            <td class="num"><b>${r.data.lpm}</b></td>
            <td class="num">${r.data.wpm}</td>
            <td class="num">${r.data.accuracy}%</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---- escuta ----
  function renderEscuta(content: HTMLElement) {
    const all = escutaOnly(results);
    if (!all.length) {
      content.innerHTML = emptyHtml('Nenhum jogo de Escuta ainda. Jogue um e volte aqui!') +
        `<div class="center"><a class="btn primary" href="#escuta">${ICONS.headphones} jogar Escuta</a></div>`;
      return;
    }
    const list = filterEscuta(all, state.speed);
    const s = escutaSummary(list);

    content.innerHTML = `
      <div class="tiles">
        ${tile('Vitórias', list.length ? `${s.winRate}%` : '—', `${s.wins} de ${s.played} jogos`)}
        ${tile('Sequência atual', String(s.streak), `melhor: ${s.bestStreak}`)}
        ${tile('Média de tentativas', s.wins ? String(s.avgAttempts).replace('.', ',') : '—', 'nas vitórias')}
        ${tile('Jogos', String(s.played), state.speed === 'all' ? 'todas as velocidades' : `velocidade ${SPEED_NAMES[state.speed]}`)}
      </div>

      <div class="card chart-card">
        <div class="card-head"><div><h2>Tentativas até acertar</h2><p>Quantos jogos você venceu em cada tentativa, e quantos perdeu.</p></div></div>
        <div class="chart-slot"></div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Por velocidade</h2><p>Quanto mais rápido o áudio, mais difícil a escuta.</p></div></div>
        <div class="table-scroll">
          <table class="history">
            <thead><tr><th>velocidade</th><th class="num">jogos</th><th class="num">vitórias</th><th class="num">melhor sequência</th><th class="num">média de tentativas</th></tr></thead>
            <tbody>${bySpeed(all).map(({ speed, summary: x }) => `
              <tr class="${state.speed === 'all' || state.speed === speed ? '' : 'dim'}">
                <td>${SPEED_NAMES[speed]}</td>
                <td class="num">${x.played}</td>
                <td class="num">${x.played ? `<b>${x.winRate}%</b>` : '—'}</td>
                <td class="num">${x.played ? x.bestStreak : '—'}</td>
                <td class="num">${x.wins ? String(x.avgAttempts).replace('.', ',') : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div><h2>Últimos jogos</h2><p>Os 15 mais recentes no filtro atual.</p></div></div>
        <div class="table-scroll">${escutaHistory(list)}</div>
      </div>`;

    const slot = content.querySelector<HTMLElement>('.chart-slot')!;
    if (!list.length) {
      slot.innerHTML = '<p class="chart-empty">Nenhum jogo nessa velocidade.</p>';
      return;
    }
    cleanups.push(
      columnChart(slot, attemptsDistribution(list), {
        color: 'var(--viz-1)',
        ariaLabel: `Distribuição de tentativas em ${list.length} jogos`,
        labelHead: 'tentativa',
        valueHead: 'jogos',
      }),
    );
  }

  function escutaHistory(list: EscutaResult[]) {
    if (!list.length) return '<p class="chart-empty">Nenhum jogo nessa velocidade.</p>';
    return `
      <table class="history">
        <thead><tr><th>quando</th><th>velocidade</th><th>palavra</th><th>resultado</th></tr></thead>
        <tbody>${list.slice(-15).reverse().map((r) => `
          <tr>
            <td>${fmtDate(r.createdAt)}</td>
            <td>${SPEED_NAMES[r.speed]}</td>
            <td class="mono">${r.data.word}</td>
            <td>${r.data.won ? `acertou em <b>${r.data.attempts}</b>` : '<span class="muted">não acertou</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ---- eventos ----
  const onClick = (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!btn) return;
    const { f, v } = btn.dataset;
    if (!f || v === undefined) return;
    if (f === 'jogo') state.game = v as Game;
    else if (f === 'velocidade') state.speed = v as Speed | 'all';
    else if (f === 'controle') state.typing.control = v as Control | 'all';
    else if (f === 'dica') state.typing.hint = v as TypingFilter['hint'];
    else if (f === 'tempo') state.typing.duration = v === 'all' ? 'all' : Number(v);
    render();
  };
  container.addEventListener('click', onClick);

  render();

  return () => {
    cleanups.forEach((c) => c());
    container.removeEventListener('click', onClick);
    container.removeEventListener('click', onMenu);
    container.innerHTML = '';
  };
}
