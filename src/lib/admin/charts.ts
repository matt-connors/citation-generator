/**
 * A small, dependency-free SVG chart library for the admin dashboard.
 *
 * The dashboard is server-rendered Astro with no client JS, so these render
 * pure SVG strings the page injects with `set:html`. Two rules follow from
 * that and from `docs`/the dataviz guidance:
 *
 *   - Every dynamic value that lands in markup is passed through {@link escapeXml}
 *     — host names and URLs reach these charts from user-cited pages.
 *   - Interactivity is the zero-JS kind: native `<title>` tooltips on each mark,
 *     plus direct end-labels and a legend the page renders alongside, so series
 *     identity is never carried by color alone.
 *
 * Series colors are the dataviz dark-mode categorical slots (blue / aqua /
 * yellow / violet / red), validated as a set against the panel surface
 * (`#161922`): worst adjacent CVD ΔE 15.7, all ≥ 3:1 contrast. Grid and axis
 * strokes reference the page's CSS custom properties so they stay theme-aware.
 */

/** Dark-mode categorical slots, in CVD-safety order. Assign by index, never cycle. */
export const SERIES_COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767'] as const;

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

interface ChartOpts {
  width?: number;
  height?: number;
}

const LINE_DEFAULTS = { width: 820, height: 260 };
const BAR_DEFAULTS = { width: 820, height: 240 };

/** Round up to a "nice" axis maximum (1/2/5 × 10ⁿ) so gridlines land on round numbers. */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

/**
 * Number of gridline intervals to draw across a `niceCeil` maximum so that
 * every tick value is a whole number — the chart data is always integer counts,
 * so a max of 1 must show ticks {0,1}, not {0,0.25,0.5,0.75,1}. `niceCeil`
 * always returns 1/2/5 × 10ⁿ, all of which divide evenly by one of 5/2/1.
 */
export function tickCountFor(yMax: number): number {
  for (const c of [5, 4, 3, 2, 1]) {
    if (yMax % c === 0) return c;
  }
  return 1;
}

/**
 * Multi-series line chart with a zeroed y-axis, four gridlines, x-axis labels
 * (thinned to avoid collisions), per-point `<title>` tooltips, and a direct
 * end-label on each series. `xLabels` aligns index-for-index with each series'
 * `values`. Returns '' when there is nothing to plot.
 */
export function renderLineChart(series: LineSeries[], xLabels: string[], opts: ChartOpts = {}): string {
  const width = opts.width ?? LINE_DEFAULTS.width;
  const height = opts.height ?? LINE_DEFAULTS.height;
  const live = series.filter((s) => s.values.length > 0);
  const n = Math.max(0, ...live.map((s) => s.values.length));
  if (!live.length || n === 0) return '';

  const m = { top: 16, right: 64, bottom: 30, left: 48 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const rawMax = Math.max(1, ...live.flatMap((s) => s.values));
  const yMax = niceCeil(rawMax);
  const xOf = (i: number) => m.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => m.top + plotH - (v / yMax) * plotH;

  const parts: string[] = [];

  // Horizontal gridlines + y-axis tick labels at whole-number steps.
  const yTicks = tickCountFor(yMax);
  for (let t = 0; t <= yTicks; t++) {
    const val = (yMax * t) / yTicks;
    const y = yOf(val);
    parts.push(
      `<line x1="${m.left}" y1="${y.toFixed(1)}" x2="${(width - m.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--panel-border)" stroke-width="1" />`,
      `<text x="${(m.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="chart-tick">${escapeXml(fmtNum(val))}</text>`,
    );
  }

  // X-axis labels, thinned so at most ~8 render.
  const stride = Math.max(1, Math.ceil(n / 8));
  for (let i = 0; i < n; i += stride) {
    parts.push(
      `<text x="${xOf(i).toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" class="chart-tick">${escapeXml(xLabels[i] ?? '')}</text>`,
    );
  }

  // One path + labelled points per series. Colors come from our own palette,
  // but they still flow through escapeXml to keep the module's "every dynamic
  // value is escaped" invariant true regardless of caller.
  for (const s of live) {
    const color = escapeXml(s.color);
    const pts = s.values.map((v, i) => [xOf(i), yOf(v)] as const);
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"><title>${escapeXml(s.label)} · ${escapeXml(xLabels[i] ?? '')}: ${escapeXml(fmtNum(s.values[i]))}</title></circle>`,
      );
    }
    const [lastX, lastY] = pts[pts.length - 1];
    parts.push(
      `<text x="${(lastX + 6).toFixed(1)}" y="${(lastY + 3).toFixed(1)}" class="chart-endlabel" fill="${color}">${escapeXml(fmtNum(s.values[s.values.length - 1]))}</text>`,
    );
  }

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}

export interface Bar {
  label: string;
  value: number;
  /** Optional longer text for the hover tooltip; falls back to `label`. */
  title?: string;
}

/**
 * Vertical bar chart / histogram with a zeroed y-axis, whole-number gridlines,
 * and a per-bar native `<title>` tooltip carrying the exact value (kept off the
 * bars themselves so a dense histogram of 40 bars doesn't collide). A 2px
 * surface gap sits between adjacent bars (dataviz spacer rule). Returns '' when
 * there is no data.
 */
export function renderBarChart(bars: Bar[], opts: ChartOpts = {}): string {
  const width = opts.width ?? BAR_DEFAULTS.width;
  const height = opts.height ?? BAR_DEFAULTS.height;
  if (!bars.length) return '';

  const m = { top: 20, right: 12, bottom: 30, left: 48 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;

  const rawMax = Math.max(1, ...bars.map((b) => b.value));
  const yMax = niceCeil(rawMax);
  const yOf = (v: number) => m.top + plotH - (v / yMax) * plotH;
  const slot = plotW / bars.length;
  const gap = bars.length > 1 ? 2 : 0;
  const barW = Math.max(1, slot - gap);
  const color = escapeXml(SERIES_COLORS[0]);

  const parts: string[] = [];
  const yTicks = tickCountFor(yMax);
  for (let t = 0; t <= yTicks; t++) {
    const val = (yMax * t) / yTicks;
    const y = yOf(val);
    parts.push(
      `<line x1="${m.left}" y1="${y.toFixed(1)}" x2="${(width - m.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--panel-border)" stroke-width="1" />`,
      `<text x="${(m.left - 8).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="chart-tick">${escapeXml(fmtNum(val))}</text>`,
    );
  }

  const stride = Math.max(1, Math.ceil(bars.length / 16));
  bars.forEach((b, i) => {
    const x = m.left + i * slot + gap / 2;
    const y = yOf(b.value);
    const h = m.top + plotH - y;
    parts.push(
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${color}"><title>${escapeXml(b.title ?? b.label)}: ${escapeXml(fmtNum(b.value))}</title></rect>`,
    );
    if (i % stride === 0) {
      parts.push(
        `<text x="${(x + barW / 2).toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" class="chart-tick">${escapeXml(b.label)}</text>`,
      );
    }
  });

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="xMidYMid meet">${parts.join('')}</svg>`;
}
