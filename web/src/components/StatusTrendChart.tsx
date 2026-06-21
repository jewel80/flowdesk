import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useDailyStatusTrend } from '../api/hooks';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayRow {
  day: number;
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

interface CanvasState {
  dpr: number; lw: number; lh: number;
  chartT: number; drawT: number; hovered: number;
  drawRaf: number | null;
  modeRaf: number | null;
  data: DayRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'INVOICED'] as const;
type SK = typeof STATUSES[number];

const COLORS: Record<SK, string> = {
  SUBMITTED: '#f59e0b',
  APPROVED:  '#10b981',
  REJECTED:  '#f43f5e',
  INVOICED:  '#3b5bdb',
};

const LABELS: Record<SK, string> = {
  SUBMITTED: 'Submitted',
  APPROVED:  'Approved',
  REJECTED:  'Rejected',
  INVOICED:  'Invoiced',
};

const PAD = { t: 12, r: 8, b: 48, l: 42 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(str: string): string {
  const [y, m] = str.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function offsetMonth(str: string, delta: number): string {
  const [y, m] = str.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / e) * e;
}

function eio(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function drawRoundedTop(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): boolean {
  if (h < 0.5 || w < 0.5) return false;
  r = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x,     y + h);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,     r);
  ctx.closePath();
  return true;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StatusTrendChart() {
  const [monthStr, setMonthStr] = useState(nowMonthStr);
  const [mode, setMode]         = useState<'stacked' | 'grouped'>('stacked');

  const { data, isLoading } = useDailyStatusTrend(monthStr);

  // DOM refs
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const ribbonRef  = useRef<HTMLDivElement>(null);

  // Keep monthStr accessible in stable callbacks without recreation
  const monthStrRef = useRef(monthStr);
  useEffect(() => { monthStrRef.current = monthStr; }, [monthStr]);

  // All mutable canvas state — no React re-renders
  const cs = useRef<CanvasState>({
    dpr: 1, lw: 0, lh: 0,
    chartT: 0, drawT: 0, hovered: -1,
    drawRaf: null, modeRaf: null, data: [],
  });

  // Month navigation bounds: 5 months back from today
  const earliest   = useMemo(() => offsetMonth(nowMonthStr(), -5), []);
  const canGoPrev  = monthStr > earliest;
  const canGoNext  = monthStr < nowMonthStr();

  // Totals derived from API data — drives ribbon, legend, stats
  const totals = useMemo(() => {
    const t: Record<SK | 'grand', number> = {
      SUBMITTED: 0, APPROVED: 0, REJECTED: 0, INVOICED: 0, grand: 0,
    };
    if (!data?.days) return t;
    for (const d of data.days) {
      t.SUBMITTED += d.SUBMITTED ?? 0;
      t.APPROVED  += d.APPROVED  ?? 0;
      t.REJECTED  += d.REJECTED  ?? 0;
      t.INVOICED  += d.INVOICED  ?? 0;
    }
    t.grand = t.SUBMITTED + t.APPROVED + t.REJECTED + t.INVOICED;
    return t;
  }, [data]);

  // ── Draw ───────────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { lw, lh, chartT, drawT, hovered, data: rows } = cs.current;
    ctx.clearRect(0, 0, lw, lh);
    if (rows.length === 0) return;

    const x0 = PAD.l, y0 = PAD.t;
    const cw = lw - PAD.l - PAD.r;
    const ch = lh - PAD.t - PAD.b;
    const n  = rows.length;

    let rawMax = 0;
    for (const row of rows) {
      const tot = row.SUBMITTED + row.APPROVED + row.REJECTED + row.INVOICED;
      if (tot > rawMax) rawMax = tot;
    }
    const maxY   = niceMax(rawMax * 1.12 || 10);
    const yScale = ch / maxY;
    const groupW = cw / n;

    // Grid lines + y-axis labels
    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v  = Math.round(maxY * i / ticks);
      const gy = y0 + ch - v * yScale;
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + cw, gy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle    = '#94a3b8';
      ctx.font         = `500 9.5px 'SF Mono','Cascadia Code','Consolas',monospace`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), x0 - 6, gy);
    }

    // Hover column highlight
    if (hovered >= 0 && hovered < n) {
      ctx.fillStyle = 'rgba(59,91,219,0.05)';
      ctx.fillRect(x0 + hovered * groupW, y0, groupW, ch);
      ctx.fillStyle = 'rgba(59,91,219,0.18)';
      ctx.fillRect(x0 + hovered * groupW + 1, y0, groupW - 2, 2.5);
    }

    // Bar geometry
    const marg = 0.13;
    const bwS  = groupW * (1 - marg * 2);
    const nsq  = STATUSES.length;
    const iGap = Math.max(0.8, groupW * 0.022);
    const bwG  = (bwS - iGap * (nsq - 1)) / nsq;

    for (let i = 0; i < n; i++) {
      const row = rows[i];
      if (!row) continue;
      if (row.SUBMITTED + row.APPROVED + row.REJECTED + row.INVOICED === 0) continue;

      const xLeft = x0 + i * groupW + groupW * marg;
      let topS = -1;
      for (let s = nsq - 1; s >= 0; s--) {
        if (row[STATUSES[s]] > 0) { topS = s; break; }
      }

      let stackY = y0 + ch;

      for (let s = 0; s < nsq; s++) {
        const key  = STATUSES[s];
        const val  = row[key];
        const rawH = val * yScale * drawT;

        if (rawH < 0.35) { stackY -= rawH; continue; }

        // Stacked geometry
        const sx = xLeft;
        const sy = stackY - rawH;
        const sw = bwS;

        // Grouped geometry
        const gx  = xLeft + s * (bwG + iGap);
        const gy2 = y0 + ch - rawH;
        const gw  = bwG;

        // Interpolate between stacked (chartT=0) and grouped (chartT=1)
        const bx = sx + (gx - sx) * chartT;
        const by = sy + (gy2 - sy) * chartT;
        const bw = sw + (gw - sw) * chartT;
        const bh = rawH;

        // Rounded caps: stacked → only topmost bar; grouped → all
        const isTop  = s === topS;
        const radius = (isTop ? 3 : 0) + (3 - (isTop ? 3 : 0)) * chartT;

        ctx.fillStyle = COLORS[key];
        if (!drawRoundedTop(ctx, bx, by, bw, bh, radius)) {
          ctx.fillRect(bx, by, bw, bh);
        } else {
          ctx.fill();
        }

        stackY -= rawH;
      }
    }

    // X-axis labels
    ctx.fillStyle    = '#94a3b8';
    ctx.font         = `500 9.5px 'SF Mono','Cascadia Code','Consolas',monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    const step = n > 20 ? 5 : (n > 10 ? 3 : 2);
    for (let i = 0; i < n; i++) {
      if (i % step !== 0 && i !== n - 1) continue;
      const lx = x0 + i * groupW + groupW / 2;
      ctx.fillText(String(rows[i]?.day ?? i + 1).padStart(2, '0'), lx, y0 + ch + 8);
    }
    ctx.fillStyle = '#c4cad5';
    ctx.font      = `500 9px system-ui,sans-serif`;
    ctx.fillText('Day of month', x0 + cw / 2, y0 + ch + 31);
  }, []);

  // ── Canvas init ────────────────────────────────────────────────────────────

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cs.current.dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    cs.current.lw = r.width;
    cs.current.lh = r.height;
    canvas.width  = Math.round(r.width  * cs.current.dpr);
    canvas.height = Math.round(r.height * cs.current.dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(cs.current.dpr, 0, 0, cs.current.dpr, 0, 0);
  }, []);

  // ── Animation ──────────────────────────────────────────────────────────────

  const runAnim = useCallback((
    getter: () => number,
    setter: (v: number) => void,
    to: number,
    dur: number,
    rafKey: 'drawRaf' | 'modeRaf',
  ) => {
    const prev = cs.current[rafKey];
    if (prev !== null) cancelAnimationFrame(prev);
    const noAnim = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (noAnim) { setter(to); draw(); return; }
    const from = getter();
    const t0   = performance.now();
    const frame = (now: number) => {
      const raw = Math.min((now - t0) / dur, 1);
      setter(from + (to - from) * eio(raw));
      draw();
      if (raw < 1) {
        cs.current[rafKey] = requestAnimationFrame(frame);
      } else {
        cs.current[rafKey] = null;
        setter(to);
        draw();
      }
    };
    cs.current[rafKey] = requestAnimationFrame(frame);
  }, [draw]);

  // ── Tooltip ────────────────────────────────────────────────────────────────

  const showTT = useCallback((idx: number, mx: number, my: number) => {
    const el  = tooltipRef.current;
    const row = cs.current.data[idx];
    if (!el || !row) return;

    const [y, m] = monthStrRef.current.split('-');
    const dd  = String(row.day).padStart(2, '0');
    const mm  = m.padStart(2, '0');
    const tot = row.SUBMITTED + row.APPROVED + row.REJECTED + row.INVOICED;

    el.innerHTML = `
      <div class="trend-tt__date">${dd}-${mm}-${y}</div>
      ${STATUSES.map(k => `
        <div class="trend-tt__row">
          <span class="trend-tt__pip" style="background:${COLORS[k]}"></span>
          <span class="trend-tt__name">${LABELS[k]}</span>
          <span class="trend-tt__val" style="color:${COLORS[k]}">${row[k]}</span>
        </div>`).join('')}
      <div class="trend-tt__sep"></div>
      <div class="trend-tt__total">
        <span class="trend-tt__total-lbl">Total</span>
        <span class="trend-tt__total-val">${tot}</span>
      </div>`;

    el.classList.add('trend-tooltip--show');

    const ttW = 162;
    let left  = mx - ttW / 2;
    if (left < 4) left = 4;
    if (left + ttW > cs.current.lw - 4) left = cs.current.lw - ttW - 4;
    let top = my - 148 - 14;
    if (top < 4) top = my + 22;
    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
  }, []);

  const hideTT = useCallback(() => {
    tooltipRef.current?.classList.remove('trend-tooltip--show');
  }, []);

  // ── Mouse events ───────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const { lw, lh, data: rows } = cs.current;
    const x0 = PAD.l, y0 = PAD.t;
    const cw = lw - PAD.l - PAD.r;
    const ch = lh - PAD.t - PAD.b;
    const n  = rows.length;

    if (!n || mx < x0 || mx > x0 + cw || my < y0 || my > y0 + ch) {
      if (cs.current.hovered !== -1) { cs.current.hovered = -1; draw(); hideTT(); }
      return;
    }
    const idx = Math.min(Math.floor((mx - x0) / (cw / n)), n - 1);
    if (idx !== cs.current.hovered) { cs.current.hovered = idx; draw(); }
    showTT(idx, mx, my);
  }, [draw, showTT, hideTT]);

  const handleMouseLeave = useCallback(() => {
    if (cs.current.hovered !== -1) { cs.current.hovered = -1; draw(); hideTT(); }
  }, [draw, hideTT]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Sync API data → ref, then play intro animation
  useEffect(() => {
    cs.current.data = (data?.days ?? []).map(d => ({
      day:       parseInt(d.date.split('-')[2], 10),
      SUBMITTED: d.SUBMITTED ?? 0,
      APPROVED:  d.APPROVED  ?? 0,
      REJECTED:  d.REJECTED  ?? 0,
      INVOICED:  d.INVOICED  ?? 0,
    }));
    cs.current.drawT = 0;
    draw();
    runAnim(() => cs.current.drawT, v => { cs.current.drawT = v; }, 1, 580, 'drawRaf');
  }, [data, draw, runAnim]);

  // Mode change → animate chartT
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    const target = mode === 'grouped' ? 1 : 0;
    runAnim(() => cs.current.chartT, v => { cs.current.chartT = v; }, target, 380, 'modeRaf');
  }, [mode, runAnim]);

  // Canvas setup + resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initCanvas();
    draw();
    const ro = new ResizeObserver(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
      initCanvas();
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [initCanvas, draw]);

  // Ribbon segments: reset to 0 then animate to actual widths
  useEffect(() => {
    const el = ribbonRef.current;
    if (!el) return;
    const segs = el.querySelectorAll<HTMLElement>('.trend-ribbon__seg');
    segs.forEach(seg => { seg.style.transitionDuration = '0s'; seg.style.width = '0'; });
    void el.offsetWidth; // force reflow so the 0-width state is painted
    const grand = totals.grand;
    segs.forEach(seg => {
      const key = seg.dataset.key as SK;
      seg.style.transitionDuration = '';
      seg.style.width = grand > 0 ? `${(totals[key] / grand) * 100}%` : '0%';
    });
  }, [totals]);

  // Cleanup on unmount
  useEffect(() => {
    // Capture current cs.current value for cleanup
    const state = cs.current;
    return () => {
      if (state.drawRaf !== null) cancelAnimationFrame(state.drawRaf);
      if (state.modeRaf !== null) cancelAnimationFrame(state.modeRaf);
    };
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card trend-card">

      {/* Pipeline Pulse ribbon — proportional status distribution */}
      <div className="trend-ribbon" ref={ribbonRef} aria-hidden="true">
        {STATUSES.map(k => (
          <div
            key={k}
            className="trend-ribbon__seg"
            data-key={k}
            style={{ background: COLORS[k] }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="trend-header">
        <div>
          <div className="trend-eyebrow">FlowDesk Analytics</div>
          <h2 className="trend-title">Monthly Status Trend</h2>
        </div>
        <div className="trend-controls">
          <div className="trend-month-nav">
            <button
              className="trend-nav-btn"
              onClick={() => setMonthStr(m => offsetMonth(m, -1))}
              disabled={!canGoPrev}
              aria-label="Previous month"
            >
              &#8249;
            </button>
            <span className="trend-month-label">{monthLabel(monthStr)}</span>
            <button
              className="trend-nav-btn"
              onClick={() => setMonthStr(m => offsetMonth(m, +1))}
              disabled={!canGoNext}
              aria-label="Next month"
            >
              &#8250;
            </button>
          </div>
          <div className="trend-view-toggle" role="group" aria-label="Chart style">
            <button
              className={`trend-toggle-btn${mode === 'stacked' ? ' trend-toggle-btn--active' : ''}`}
              onClick={() => setMode('stacked')}
            >
              Stacked
            </button>
            <button
              className={`trend-toggle-btn${mode === 'grouped' ? ' trend-toggle-btn--active' : ''}`}
              onClick={() => setMode('grouped')}
            >
              Grouped
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="trend-legend">
        {STATUSES.map(k => (
          <div key={k} className="trend-legend-item">
            <span className="trend-legend-pip" style={{ background: COLORS[k] }} />
            <span className="trend-legend-name">{LABELS[k]}</span>
            <span className="trend-legend-count">{totals[k]}</span>
          </div>
        ))}
      </div>

      <div className="trend-rule" />

      {/* Chart */}
      <div className="trend-chart-wrap">
        {isLoading && (
          <div className="trend-loading" aria-live="polite">
            Loading trend data…
          </div>
        )}
        {!isLoading && totals.grand === 0 && (
          <div className="trend-empty">
            No activity recorded for this month.
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          role="img"
          aria-label={`Monthly billing status trend for ${monthLabel(monthStr)}`}
        />
        <div className="trend-tooltip" ref={tooltipRef} />
      </div>

      {/* Footer stat row */}
      {!isLoading && totals.grand > 0 && (
        <div className="trend-stats">
          {STATUSES.map(k => {
            const pct = ((totals[k] / totals.grand) * 100).toFixed(1);
            return (
              <div key={k} className="trend-stat">
                <div className="trend-stat__label" style={{ color: COLORS[k] }}>
                  {LABELS[k]}
                </div>
                <div className="trend-stat__value" style={{ color: COLORS[k] }}>
                  {totals[k]}
                </div>
                <div className="trend-stat__pct">{pct}% of activity</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
