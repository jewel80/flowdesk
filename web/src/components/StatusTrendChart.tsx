import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useMonthlyStatusTrends } from '../api/hooks';
import { LoadingState } from './States';

const STATUS_COLORS = {
  SUBMITTED: '#f59e0b',
  APPROVED:  '#10b981',
  REJECTED:  '#ef4444',
  INVOICED:  '#3b82f6',
} as const;

const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  APPROVED:  'Approved',
  REJECTED:  'Rejected',
  INVOICED:  'Invoiced',
} as const;

type StatusKey = keyof typeof STATUS_COLORS;

interface TooltipEntry {
  name: string;
  value: number;
  fill: string;
  dataKey: string;
}

interface MonthTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function MonthTooltip({ active, payload, label }: MonthTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value ?? 0), 0);
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__date">{label}</div>
      {payload.filter(p => p.value > 0).map(p => (
        <div key={p.dataKey} className="chart-tooltip__row">
          <span className="chart-tooltip__dot" style={{ background: p.fill }} />
          <span className="chart-tooltip__name">{p.name}</span>
          <span className="chart-tooltip__value">{p.value}</span>
        </div>
      ))}
      {total > 0 && <div className="chart-tooltip__total">Total: {total}</div>}
    </div>
  );
}

export function StatusTrendChart() {
  const { monthStrings, results } = useMonthlyStatusTrends(6);
  const isLoading = results.some(r => r.isLoading);

  const chartData = monthStrings.map((month, i) => {
    const days = results[i]?.data?.days ?? [];
    const [y, m] = month.split('-').map(Number);
    return {
      month: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      Submitted: days.reduce((s, d) => s + (d.SUBMITTED ?? 0), 0),
      Approved:  days.reduce((s, d) => s + (d.APPROVED  ?? 0), 0),
      Rejected:  days.reduce((s, d) => s + (d.REJECTED  ?? 0), 0),
      Invoiced:  days.reduce((s, d) => s + (d.INVOICED  ?? 0), 0),
    };
  });

  const totalAll = chartData.reduce((s, d) => s + d.Submitted + d.Approved + d.Rejected + d.Invoiced, 0);

  if (isLoading) return <LoadingState label="Loading trend data…" />;

  const keys = Object.entries(STATUS_LABELS) as [StatusKey, string][];

  return (
    <div className="card status-trend-chart">
      <div className="status-trend-chart__header">
        <div>
          <h2 className="card__title">Monthly Status Trend</h2>
          <p className="status-trend-chart__subtitle">
            Last 6 months &middot; <strong>{totalAll}</strong> total events
          </p>
        </div>
      </div>

      {totalAll === 0 ? (
        <div className="state state--empty">
          <strong>No activity data</strong>
          <p>Status trends will appear once requests are processed.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={chartData}
            margin={{ top: 12, right: 16, left: -8, bottom: 0 }}
            barCategoryGap="32%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f2f5" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<MonthTooltip />}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingTop: '12px', color: '#6b7280' }}
            />
            {keys.map(([key, label], idx) => (
              <Bar
                key={key}
                dataKey={label}
                stackId="a"
                fill={STATUS_COLORS[key]}
                isAnimationActive={false}
                radius={idx === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
