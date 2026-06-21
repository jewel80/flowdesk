import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePIStatusSummary } from '../api/hooks';
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

interface TooltipPayload {
  name: string;
  value: number;
  payload: { color: string };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: p } = payload[0];
  return (
    <div className="chart-tooltip" style={{ minWidth: 0 }}>
      <div className="chart-tooltip__row">
        <span className="chart-tooltip__dot" style={{ background: p.color }} />
        <span className="chart-tooltip__name">{name}</span>
        <span className="chart-tooltip__value">{value}</span>
      </div>
    </div>
  );
}

export function PIStatusChart() {
  const { data, isLoading, isError } = usePIStatusSummary();

  if (isLoading) return <LoadingState label="Loading status summary…" />;
  if (isError) {
    return (
      <div className="state state--error">
        <strong>Failed to load status summary</strong>
      </div>
    );
  }

  const chartData = data
    ? (Object.entries(data) as [StatusKey, number][]).map(([status, count]) => ({
        name: STATUS_LABELS[status],
        value: count,
        color: STATUS_COLORS[status],
      }))
    : [];

  const total = chartData.reduce((s, e) => s + e.value, 0);

  if (total === 0) {
    return (
      <div className="pi-status-chart pi-status-chart--empty">
        <div className="state state--empty">
          <strong>No billing requests</strong>
          <p>Status summary will appear once requests are created</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pi-status-chart">
      <div className="pi-status-chart__header">
        <div>
          <h2 className="card__title">PI Status Summary</h2>
          <p className="status-trend-chart__subtitle">{total} total requests</p>
        </div>
      </div>

      <div className="pi-status-chart__body">
        {/* Donut chart */}
        <div className="pi-status-chart__donut">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pi-status-chart__center">
            <span className="pi-status-chart__total">{total}</span>
            <span className="pi-status-chart__total-label">total</span>
          </div>
        </div>

        {/* Stat rows */}
        <div className="pi-status-chart__stats">
          {chartData.map((entry) => (
            <div key={entry.name} className="pi-stat">
              <span className="pi-stat__dot" style={{ background: entry.color }} />
              <span className="pi-stat__name">{entry.name}</span>
              <span className="pi-stat__count">{entry.value}</span>
              <span className="pi-stat__pct">
                {total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
