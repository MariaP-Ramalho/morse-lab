/**
 * Gráficos em SVG puro, sem biblioteca. Cada gráfico tem tooltip (mouse e teclado)
 * e uma tabela equivalente, para que nenhum valor dependa só da cor ou do hover.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface LineSeries {
  name: string;
  /** Variável CSS da cor, ex.: 'var(--viz-1)'. */
  color: string;
  values: number[];
  /** Linha em degraus (bom para "recorde até aqui"). */
  step?: boolean;
  /** Rótulo direto no fim da linha. */
  endLabel?: boolean;
}

export interface LineChartData {
  /** Rótulo de cada ponto no tooltip e na tabela (ex.: data da rodada). */
  labels: string[];
  series: LineSeries[];
  /** Unidade mostrada depois dos valores (ex.: 'LPM'). */
  unit: string;
}

export interface ColumnDatum {
  label: string;
  value: number;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function text(x: number, y: number, value: string, cls: string, anchor = 'start') {
  const t = el('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = value;
  return t;
}

/** Topo do eixo arredondado para um número "limpo" (5, 10, 20, 25, 50...). */
export function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

function tableHtml(head: string[], rows: (string | number)[][]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'chart-table';
  const summary = document.createElement('summary');
  summary.textContent = 'ver tabela';
  const table = document.createElement('table');
  const tr = table.createTHead().insertRow();
  head.forEach((h) => (tr.appendChild(document.createElement('th')).textContent = h));
  const body = table.createTBody();
  for (const r of rows) {
    const row = body.insertRow();
    r.forEach((c) => (row.insertCell().textContent = String(c)));
  }
  details.append(summary, table);
  return details;
}

/** Observa a largura do container e redesenha. Devolve a função de limpeza. */
function responsive(container: HTMLElement, draw: (width: number) => void): () => void {
  let last = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(container.clientWidth);
    if (w && w !== last) draw((last = w));
  });
  ro.observe(container);
  draw((last = Math.round(container.clientWidth) || 600));
  return () => ro.disconnect();
}

// ---------------- linha ----------------

export function lineChart(container: HTMLElement, data: LineChartData, ariaLabel: string): () => void {
  const n = data.labels.length;
  const H = 240;
  const pad = { top: 18, right: 78, bottom: 30, left: 40 };
  const all = data.series.flatMap((s) => s.values);
  const yMax = niceMax(Math.max(...all, 1));

  const wrap = document.createElement('div');
  wrap.className = 'chart';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', ariaLabel);
  const tip = document.createElement('div');
  tip.className = 'chart-tip hidden';

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  if (data.series.length > 1) {
    for (const s of data.series) {
      const item = document.createElement('span');
      const key = document.createElement('i');
      key.className = 'key-line';
      key.style.background = s.color;
      item.append(key, document.createTextNode(s.name));
      legend.append(item);
    }
  }

  container.replaceChildren(legend, wrap, tableHtml(['rodada', ...data.series.map((s) => `${s.name} (${data.unit})`)],
    data.labels.map((l, i) => [l, ...data.series.map((s) => s.values[i])])));

  let active = -1;
  let geom: { x: (i: number) => number; y: (v: number) => number; width: number } | null = null;
  let hoverLayer: SVGGElement | null = null;

  function draw(width: number) {
    const W = Math.max(width, 280);
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    const x = (i: number) => pad.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => pad.top + ih - (v / yMax) * ih;
    geom = { x, y, width: W };

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    // grade e eixo Y
    for (let k = 0; k <= 4; k++) {
      const v = (yMax / 4) * k;
      svg.append(el('line', { x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v), class: k ? 'grid' : 'axis' }));
      svg.append(text(pad.left - 8, y(v) + 4, String(Math.round(v * 10) / 10), 'tick', 'end'));
    }
    // eixo X: primeira e última rodada (+ meio quando cabe)
    const ticks = n <= 1 ? [0] : n < 6 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];
    for (const i of ticks) svg.append(text(x(i), H - 8, `#${i + 1}`, 'tick', 'middle'));

    for (const s of data.series) {
      if (n > 1) {
        let d = '';
        s.values.forEach((v, i) => {
          if (i === 0) d = `M${x(0)},${y(v)}`;
          else if (s.step) d += `H${x(i)}V${y(v)}`;
          else d += `L${x(i)},${y(v)}`;
        });
        svg.append(el('path', { d, class: 'series-line', stroke: s.color }));
      }
      const lastV = s.values[n - 1];
      svg.append(el('circle', { cx: x(n - 1), cy: y(lastV), r: 4, fill: s.color, class: 'dot' }));
      if (s.endLabel) svg.append(text(x(n - 1) + 10, y(lastV) + 4, `${s.name} ${lastV}`, 'end-label'));
    }

    hoverLayer = el('g', { class: 'hover' });
    svg.append(hoverLayer);
    // área de captura maior que as marcas: o gráfico inteiro
    const hit = el('rect', { x: pad.left - 10, y: 0, width: iw + 20, height: H, fill: 'transparent' });
    hit.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      show(n === 1 ? 0 : Math.round(((px - pad.left) / iw) * (n - 1)));
    });
    hit.addEventListener('pointerleave', () => show(-1));
    svg.append(hit);

    wrap.replaceChildren(svg, tip);
    if (active >= 0) show(active);
  }

  function show(i: number) {
    active = i < 0 ? -1 : Math.max(0, Math.min(n - 1, i));
    if (!hoverLayer || !geom) return;
    hoverLayer.replaceChildren();
    if (active < 0) {
      tip.classList.add('hidden');
      return;
    }
    const { x, y, width } = geom;
    const cx = x(active);
    hoverLayer.append(el('line', { x1: cx, x2: cx, y1: pad.top, y2: H - pad.bottom, class: 'crosshair' }));
    for (const s of data.series) hoverLayer.append(el('circle', { cx, cy: y(s.values[active]), r: 5, fill: s.color, class: 'dot' }));

    const title = document.createElement('div');
    title.className = 'tip-title';
    title.textContent = `rodada ${active + 1} · ${data.labels[active]}`;
    const rows = data.series.map((s) => {
      const row = document.createElement('div');
      row.className = 'tip-row';
      const key = document.createElement('i');
      key.className = 'key-line';
      key.style.background = s.color;
      const b = document.createElement('b');
      b.textContent = `${s.values[active]} ${data.unit}`;
      const name = document.createElement('span');
      name.textContent = s.name;
      row.append(key, b, name);
      return row;
    });
    tip.replaceChildren(title, ...rows);
    tip.classList.remove('hidden');
    const left = (cx / width) * 100;
    tip.style.left = `${left}%`;
    tip.style.transform = left > 60 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
  }

  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      show(active < 0 ? n - 1 : active + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Escape') show(-1);
  });
  wrap.addEventListener('blur', () => show(-1));

  return responsive(wrap, draw);
}

// ---------------- colunas ----------------

export function columnChart(
  container: HTMLElement,
  data: ColumnDatum[],
  opts: {
    color: string;
    ariaLabel: string;
    labelHead: string;
    valueHead: string;
    /** Coluna em destaque (ex.: a partida que acabou), desenhada em `highlightColor`. */
    highlight?: number;
    highlightColor?: string;
  },
): () => void {
  const H = 200;
  const pad = { top: 22, right: 8, bottom: 30, left: 8 };
  const yMax = Math.max(...data.map((d) => d.value), 1);

  const wrap = document.createElement('div');
  wrap.className = 'chart';
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', opts.ariaLabel);
  const tip = document.createElement('div');
  tip.className = 'chart-tip hidden';
  container.replaceChildren(wrap, tableHtml([opts.labelHead, opts.valueHead], data.map((d) => [d.label, d.value])));

  function draw(width: number) {
    const W = Math.max(width, 240);
    const iw = W - pad.left - pad.right;
    const ih = H - pad.top - pad.bottom;
    const band = iw / data.length;
    const bw = Math.min(24, band * 0.6);
    const base = pad.top + ih;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    svg.append(el('line', { x1: pad.left, x2: W - pad.right, y1: base, y2: base, class: 'axis' }));

    data.forEach((d, i) => {
      const cx = pad.left + band * i + band / 2;
      const h = (d.value / yMax) * ih;
      const g = el('g', { class: 'col', tabindex: 0 });
      g.setAttribute('aria-label', `${d.label}: ${d.value}`);
      // área de captura: a faixa inteira da coluna
      g.append(el('rect', { x: cx - band / 2, y: pad.top - 20, width: band, height: ih + 20, fill: 'transparent' }));
      if (h > 0) {
        const r = Math.min(4, h, bw / 2);
        const x0 = cx - bw / 2;
        const top = base - h;
        // topo arredondado (4px), base reta
        g.append(el('path', {
          d: `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${base}Z`,
          fill: i === opts.highlight ? (opts.highlightColor ?? opts.color) : opts.color,
          class: 'bar',
        }));
      }
      g.append(text(cx, base - h - 6, String(d.value), 'cap-label', 'middle'));
      g.append(text(cx, H - 8, d.label, 'tick', 'middle'));
      const showTip = () => {
        const b = document.createElement('b');
        b.textContent = String(d.value);
        const s = document.createElement('span');
        s.textContent = `${opts.labelHead} ${d.label}`;
        tip.replaceChildren(b, s);
        tip.classList.remove('hidden');
        const left = (cx / W) * 100;
        tip.style.left = `${left}%`;
        tip.style.transform = left > 60 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)';
      };
      g.addEventListener('pointerenter', showTip);
      g.addEventListener('focus', showTip);
      g.addEventListener('pointerleave', () => tip.classList.add('hidden'));
      g.addEventListener('blur', () => tip.classList.add('hidden'));
      svg.append(g);
    });
    wrap.replaceChildren(svg, tip);
  }

  return responsive(wrap, draw);
}
