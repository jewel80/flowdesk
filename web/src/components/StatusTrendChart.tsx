import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useDailyStatusTrend } from '../api/hooks';
import { LoadingState, ErrorState } from './States';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/statusColors';

type StatusKey = keyof typeof STATUS_COLORS;

// Softer gradient start/end pairs per status
const GRAD: Record<StatusKey, string> = {
  SUBMITTED: '#f59e0b',
  APPROVED:  '#10b981',
  REJECTED:  '#ef4444',
  INVOICED:  '#3b82f6',
};

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  stroke: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function parseDayNumber(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2], 10));
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

type DayData = { date: string; Submitted: number; Approved: number; Rejected: number; Invoiced: number };

function dayTotal(d: DayData) {
  return d.Submitted + d.Approved + d.Rejected + d.Invoiced;
}

function computeTrend(data: DayData[]): { dir: 'up' | 'down' | 'flat'; pct: number } {
  if (data.length < 4) return { dir: 'flat', pct: 0 };
  const mid = Math.floor(data.length / 2);
  const first = data.slice(0, mid).reduce((s, d) => s + dayTotal(d), 0);
  const second = data.slice(mid).reduce((s, d) => s + dayTotal(d), 0);
  if (first === 0 && second === 0) return { dir: 'flat', pct: 0 };
  if (first === 0) return { dir: 'up', pct: 100 };
  const pct = Math.round(((second - first) / first) * 100);
  return { dir: pct > 3 ? 'up' : pct < -3 ? 'down' : 'flat', pct: Math.abs(pct) };
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const [y, mo, d] = (label ?? '').split('-').map(Number);
  const fullDate = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__date">{fullDate}</div>
      {total > 0 ? (
        <>
          {payload.filter(p => p.value > 0).map((p: TooltipEntry) => (
            <div key={p.dataKey} className="chart-tooltip__row">
              <span className="chart-tooltip__dot" style={{ background: p.stroke }} />
              <span className="chart-tooltip__name">{p.name}</span>
              <span className="chart-tooltip__value">{p.value}</span>
            </div>
          ))}
          <div className="chart-tooltip__total">Total: {total}</div>
        </>
      ) : (
        <div className="chart-tooltip__empty">No activity</div>
      )}
    </div>
  );
}

export function StatusTrendChart() {
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );

  const { data, isLoading, isError, error } = useDailyStatusTrend(selectedMonth);

  if (isLoading) return <LoadingState label="Loading status trend…" />;
  if (isError) return <ErrorState message={error?.message || 'Failed to load trend data'} />;

  const chartData: DayData[] = data?.days.map((day) => ({
    date: day.date,
    Submitted: day.SUBMITTED || 0,
    Approved:  day.APPROVED  || 0,
    Rejected:  day.REJECTED  || 0,
    Invoiced:  day.INVOICED  || 0,
  })) ?? [];

  const totalEvents = chartData.reduce((s, d) => s + dayTotal(d), 0);
  const trend = computeTrend(chartData);

  const peakDay = chartData.length
    ? chartData.reduce((best, d) => dayTotal(d) > dayTotal(best) ? d : best, chartData[0])
    : null;
  const peakTotal = peakDay ? dayTotal(peakDay) : 0;

  return (
    <div className="card status-trend-chart">
      <div className="status-trend-chart__header">
        <div>
          <h2 className="card__title">Monthly Status Trend</h2>
          <p className="status-trend-chart__subtitle">
            {formatMonthLabel(selectedMonth)}
            {totalEvents > 0 && (
              <>
                {' · '}<strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''}
                {trend.dir !== 'flat' && (
                  <span className={`trend-badge trend-badge--${trend.dir}`}>
                    {trend.dir === 'up' ? '↑' : '↓'} {trend.pct}%
                  </span>
                )}
              </>
            )}
          </p>
          {peakDay && peakTotal > 0 && (
            <p className="status-trend-chart__peak">
              Peak day: <strong>{parseDayNumber(peakDay.date)}</strong> · {peakTotal} events
            </p>
          )}
        </div>
        <div className="status-trend-chart__controls">
          <label htmlFor="month-select" className="status-trend-chart__label">Month:</label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="status-trend-chart__input"
          />
        </div>
      </div>

      {totalEvents === 0 ? (
        <div className="state state--empty">
          <strong>No activity this month</strong>
          <p>Status events will appear once requests are processed.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              {(Object.entries(GRAD) as [StatusKey, string][]).map(([key, color]) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
            <XAxis
              dataKey="date"
              tickFormatter={parseDayNumber}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px', color: '#6b7280' }}
            />
            {(Object.entries(STATUS_LABELS) as [StatusKey, string][]).map(([key, label]) => (
              <Area
                key={key}
                type="monotone"
                dataKey={label}
                name={label}
                stroke={GRAD[key]}
                strokeWidth={2}
                fill={`url(#grad-${key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: GRAD[key] }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
