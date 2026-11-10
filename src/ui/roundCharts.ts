import { loadResults } from '../progress/history';
import {
  attemptsDistribution,
  escutaOnly,
  filterEscuta,
  filterLetras,
  filterTyping,
  letrasOnly,
  runningBest,
  typingOnly,
} from '../progress/stats';
import type { Control, Speed } from '../shared/results';
import { columnChart, lineChart } from './charts';

/**
 * Gráficos mostrados no fim de uma partida, só com as rodadas da mesma configuração.
 * Cada função preenche `slot` e devolve a limpeza do gráfico (ResizeObserver).
 */

const noop = () => undefined;

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function head(slot: HTMLElement, title: string, sub: string): HTMLElement {
  slot.innerHTML = `<div class="card-head"><div><h2>${title}</h2><p>${sub}</p></div></div><div class="chart-slot"></div>`;
  return slot.querySelector<HTMLElement>('.chart-slot')!;
}

export function typingRoundChart(
  slot: HTMLElement,
  combo: { control: Control; hint: boolean; duration: number; name: string },
): () => void {
  const chartEl = head(slot, `Sua evolução em ${combo.name}`, 'Letras por minuto em cada rodada nessa configuração. O último ponto é esta rodada.');
  const list = filterTyping(typingOnly(loadResults('typing')), {
    control: combo.control,
    hint: combo.hint ? 'on' : 'off',
    duration: combo.duration,
  });
  if (list.length < 2) {
    chartEl.innerHTML = '<p class="chart-empty">Primeira rodada nessa configuração. Jogue de novo para ver sua evolução.</p>';
    return noop;
  }
  const lpm = list.map((r) => r.data.lpm);
  const best = runningBest(lpm);
  return lineChart(
    chartEl,
    {
      labels: list.map((r) => fmtDate(r.createdAt)),
      unit: 'LPM',
      series: [
        { name: 'rodada', color: 'var(--viz-1)', values: lpm },
        { name: 'recorde', color: 'var(--viz-2)', values: best, step: true, endLabel: true },
      ],
    },
    `Letras por minuto em ${list.length} rodadas de ${combo.name}. Esta rodada: ${lpm[lpm.length - 1]} LPM. Recorde: ${best[best.length - 1]} LPM.`,
  );
}

export function escutaRoundChart(
  slot: HTMLElement,
  game: { speed: Speed; speedName: string; won: boolean; attempts: number },
): () => void {
  const chartEl = head(
    slot,
    `Tentativas na velocidade ${game.speedName}`,
    'Quantos jogos você venceu em cada tentativa nessa velocidade. Em destaque, este jogo.',
  );
  const list = filterEscuta(escutaOnly(loadResults('escuta')), game.speed);
  const dist = attemptsDistribution(list);
  return columnChart(chartEl, dist, {
    color: 'var(--viz-1)',
    highlight: game.won ? game.attempts - 1 : dist.length - 1,
    highlightColor: 'var(--viz-2)',
    ariaLabel: `Distribuição de tentativas em ${list.length} jogos na velocidade ${game.speedName}`,
    labelHead: 'tentativa',
    valueHead: 'jogos',
  });
}

export function letrasRoundChart(
  slot: HTMLElement,
  combo: { speed: Speed; duration: number; hint: boolean; name: string },
): () => void {
  const chartEl = head(slot, `Sua evolução em ${combo.name}`, 'Letras certas em cada rodada nessa configuração. O último ponto é esta rodada.');
  const list = filterLetras(letrasOnly(loadResults('letras')), {
    speed: combo.speed,
    duration: combo.duration,
    hint: combo.hint ? 'on' : 'off',
  });
  if (list.length < 2) {
    chartEl.innerHTML = '<p class="chart-empty">Primeira rodada nessa configuração. Jogue de novo para ver sua evolução.</p>';
    return noop;
  }
  const correct = list.map((r) => r.data.correct);
  const best = runningBest(correct);
  return lineChart(
    chartEl,
    {
      labels: list.map((r) => fmtDate(r.createdAt)),
      unit: 'acertos',
      series: [
        { name: 'rodada', color: 'var(--viz-1)', values: correct },
        { name: 'recorde', color: 'var(--viz-2)', values: best, step: true, endLabel: true },
      ],
    },
    `Letras certas em ${list.length} rodadas de ${combo.name}. Esta rodada: ${correct[correct.length - 1]}. Recorde: ${best[best.length - 1]}.`,
  );
}
