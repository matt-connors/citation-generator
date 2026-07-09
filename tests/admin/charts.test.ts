import { describe, it, expect } from 'vitest';
import {
  escapeXml,
  niceCeil,
  tickCountFor,
  renderLineChart,
  renderBarChart,
  SERIES_COLORS,
  type LineSeries,
} from '../../src/lib/admin/charts';

describe('escapeXml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeXml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('renders null/undefined as an empty string', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });
});

describe('niceCeil', () => {
  it('rounds up to 1/2/5 × 10ⁿ', () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(10)).toBe(10);
    expect(niceCeil(11)).toBe(20);
    expect(niceCeil(23)).toBe(50);
    expect(niceCeil(50)).toBe(50);
    expect(niceCeil(120)).toBe(200);
  });

  it('guards non-positive and non-finite inputs', () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
  });
});

describe('tickCountFor', () => {
  it('yields whole-number tick steps for every niceCeil maximum', () => {
    // niceCeil only ever returns 1/2/5 × 10ⁿ; each must divide evenly.
    for (const yMax of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) {
      const ticks = tickCountFor(yMax);
      expect(yMax % ticks, `yMax=${yMax}`).toBe(0);
      for (let t = 0; t <= ticks; t++) {
        expect(Number.isInteger((yMax * t) / ticks), `yMax=${yMax} t=${t}`).toBe(true);
      }
    }
  });

  it('shows {0,1} for a max of 1 rather than fractional ticks', () => {
    expect(tickCountFor(1)).toBe(1);
  });
});

describe('renderLineChart / renderBarChart — integer y-axis', () => {
  it('never emits a fractional y-tick label for small integer maxima', () => {
    const svg = renderLineChart([{ label: 'S', color: SERIES_COLORS[0], values: [0, 1, 1] }], ['a', 'b', 'c']);
    // No tick text like "0.3" / "0.5" / "0.8".
    expect(svg).not.toMatch(/>0\.\d</);
    const bar = renderBarChart([{ label: '1', value: 1 }]);
    expect(bar).not.toMatch(/>0\.\d</);
  });
});

describe('renderLineChart', () => {
  const series: LineSeries[] = [
    { label: 'Sessions', color: SERIES_COLORS[0], values: [1, 3, 2, 5] },
    { label: 'Users', color: SERIES_COLORS[1], values: [1, 2, 2, 3] },
  ];
  const xLabels = ['07-01', '07-02', '07-03', '07-04'];

  it('renders an SVG with a path and tooltip per series', () => {
    const svg = renderLineChart(series, xLabels);
    expect(svg).toContain('<svg');
    expect(svg).toContain(SERIES_COLORS[0]);
    expect(svg).toContain(SERIES_COLORS[1]);
    // one <title> per point (native hover tooltip), zero JS.
    expect((svg.match(/<title>/g) ?? []).length).toBe(8);
    expect(svg).toContain('Sessions · 07-04: 5');
  });

  it('returns "" when there is nothing to plot', () => {
    expect(renderLineChart([], [])).toBe('');
    expect(renderLineChart([{ label: 'X', color: '#fff', values: [] }], [])).toBe('');
  });

  it('escapes hostile x-axis labels', () => {
    const svg = renderLineChart(
      [{ label: '<b>', color: '#fff', values: [1] }],
      ['<script>alert(1)</script>'],
    );
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});

describe('renderBarChart', () => {
  it('renders one rect per bar with a tooltip', () => {
    const svg = renderBarChart([
      { label: '1', value: 10 },
      { label: '2', value: 4 },
      { label: '3', value: 1 },
    ]);
    expect(svg).toContain('<svg');
    expect((svg.match(/<rect/g) ?? []).length).toBe(3);
    expect((svg.match(/<title>/g) ?? []).length).toBe(3);
  });

  it('returns "" for no data', () => {
    expect(renderBarChart([])).toBe('');
  });

  it('escapes bar labels and titles', () => {
    const svg = renderBarChart([{ label: '<x>', value: 1, title: '<evil>' }]);
    expect(svg).not.toContain('<evil>');
    expect(svg).toContain('&lt;evil&gt;');
  });
});
