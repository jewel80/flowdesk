import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useDailyStatusTrend } from '../api/hooks';
import { LoadingState, ErrorState } from './States';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/statusColors';

type StatusKey = keyof typeof STATUS_COLORS;

interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number;
  fill: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

// Parse "YYYY-MM-DD" to day number without timezone conversion
function parseDayNumber(dateStr: string): string {
  return String(parseInt(dateStr.split('-')[2], 10));
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  // label is the raw XAxis dataKey = "YYYY-MM-DD"
  const [y, mo, d] = (label ?? '').split('-').map(Number);
  const fullDate = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  const hasActivity = total > 0;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__date">{fullDate}</div>
      {hasActivity ? (
        <>
          {payload.map((p: TooltipEntry) => (
            <div key={p.dataKey} className="chart-tooltip__row">
              <span className="chart-tooltip__dot" style={{ background: p.fill }} />
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

  const chartData = data?.days.map((day) => ({
    date: day.date,
    Submitted: day.SUBMITTED || 0,
    Approved: day.APPROVED || 0,
    Rejected: day.REJECTED || 0,
    Invoiced: day.INVOICED || 0,
  })) ?? [];

  const totalEvents = chartData.reduce(
    (s, d) => s + d.Submitted + d.Approved + d.Rejected + d.Invoiced, 0
  );

  return (
    <div className="card status-trend-chart">
      <div className="status-trend-chart__header">
        <div>
          <h2 className="card__title">Monthly Status Trend</h2>
          <p className="status-trend-chart__subtitle">
            {formatMonthLabel(selectedMonth)}
            {totalEvents > 0 && <> · <strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''}</>}
          </p>
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
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            barCategoryGap="35%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
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
              cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#6b7280' }}
            />
            {(Object.entries(STATUS_LABELS) as [StatusKey, string][]).map(([key, label]) => (
              <Bar
                key={key}
                dataKey={label}
                fill={STATUS_COLORS[key]}
                name={label}
                stackId="status"
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
