import { parseResultInput, type ResultInput, type SaveResponse, type StoredResult } from '../shared/results';

/**
 * Histórico de partidas guardado no próprio navegador (localStorage).
 * Não há servidor: cada navegador tem o seu histórico.
 */

const KEY = 'morse-results';
/** Mantém só as partidas mais recentes, para não estourar o espaço do navegador. */
const MAX = 5000;

/** Lê e valida o que está salvo; entradas corrompidas ou de outra versão são ignoradas. */
export function loadResults(game?: StoredResult['game']): StoredResult[] {
  let raw: unknown;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: StoredResult[] = [];
  for (const item of raw) {
    const input = parseResultInput(item);
    const { id, createdAt } = (item ?? {}) as { id?: unknown; createdAt?: unknown };
    if (!input || typeof id !== 'number' || typeof createdAt !== 'number') continue;
    if (game && input.game !== game) continue;
    out.push({ ...input, id, createdAt } as StoredResult);
  }
  return out;
}

/** Salva uma partida. `stored` é false quando o navegador não deixou gravar (ex.: aba anônima cheia). */
export function saveResult(input: ResultInput): SaveResponse & { stored: boolean } {
  const all = loadResults();
  const out: Partial<SaveResponse> = {};

  if (input.game === 'typing') {
    const same = all.filter(
      (r) => r.game === 'typing' && r.control === input.control && r.hint === input.hint && r.duration === input.duration,
    );
    const best = same.length ? Math.max(...same.map((r) => (r.game === 'typing' ? r.data.lpm : 0))) : null;
    out.previousBest = best;
    out.isRecord = input.data.lpm > 0 && (best === null || input.data.lpm > best);
  }

  if (input.game === 'letras') {
    const same = all.filter(
      (r) => r.game === 'letras' && r.speed === input.speed && r.duration === input.duration && r.hint === input.hint,
    );
    const best = same.length ? Math.max(...same.map((r) => (r.game === 'letras' ? r.data.correct : 0))) : null;
    out.previousBest = best;
    out.isRecord = input.data.correct > 0 && (best === null || input.data.correct > best);
  }

  const result = { ...input, id: (all[all.length - 1]?.id ?? 0) + 1, createdAt: Date.now() } as StoredResult;
  all.push(result);

  let stored = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX)));
  } catch {
    stored = false;
  }

  if (input.game === 'escuta') {
    // Sequência atual: vitórias seguidas, da mais recente para trás, em todas as velocidades.
    const wins = all.filter((r) => r.game === 'escuta').map((r) => r.game === 'escuta' && r.data.won);
    const lastLoss = wins.lastIndexOf(false);
    out.summary = {
      played: wins.length,
      wins: wins.filter(Boolean).length,
      streak: wins.length - 1 - lastLoss,
    };
  }

  return { ...out, result, stored };
}
