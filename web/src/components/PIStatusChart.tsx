import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { usePIStatusSummary } from '../api/hooks';
import { LoadingState } from './States';

const STATUS_COLORS = {
  SUBMITTED: '#f59e0b', // amber
  APPROVED: '#10b981', // green
  REJECTED: '#ef4444', // red
  INVOICED: '#3b82f6', // blue
};

const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  INVOICED: 'Invoiced',
};

export function PIStatusChart() {
  const { data, isLoading, isError } = usePIStatusSummary();

  if (isLoading) return <LoadingState label="Loading status overview…" />;
  if (isError) {
    return (
      <div className="state state--error">
        <strong>Failed to load status overview</strong>
      </div>
    );
  }

  const chartData = data
    ? Object.entries(data).map(([status, count]) => ({
        name: STATUS_LABELS[status as keyof typeof STATUS_LABELS],
        value: count,
        color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
      }))
    : [];

  const total = chartData.reduce((sum, entry) => sum + entry.value, 0);

  // Show empty state if no data
  if (total === 0) {
    return (
      <div className="pi-status-chart pi-status-chart--empty">
        <div className="state state--empty">
          <strong>No billing requests</strong>
          <p>Status overview will appear once requests are created</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pi-status-chart">
      <h2>PI Status Overview</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.name}: ${entry.value}`}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              const numValue = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : 0;
              const nameStr = typeof name === 'string' ? name : String(name ?? '');
              return [
                `${numValue} (${numValue > 0 ? ((numValue / total) * 100).toFixed(1) : '0.0'}%)`,
                nameStr,
              ];
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
