import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDailyStatusTrend } from '../api/hooks';
import { LoadingState, ErrorState } from './States';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/statusColors';

export function StatusTrendChart() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to current month
    return new Date().toISOString().slice(0, 7); // YYYY-MM
  });

  const { data, isLoading, isError, error } = useDailyStatusTrend(selectedMonth);

  const handleMonthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(event.target.value);
  };

  if (isLoading) return <LoadingState label="Loading status trend…" />;
  if (isError) return <ErrorState message={error?.message || 'Failed to load trend data'} />;

  // Transform data for Recharts
  const chartData = data?.days.map((day) => {
    const dataPoint: Record<string, string | number> = {
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      Submitted: day.SUBMITTED || 0,
      Approved: day.APPROVED || 0,
      Rejected: day.REJECTED || 0,
      Invoiced: day.INVOICED || 0,
    };
    return dataPoint;
  }) || [];

  const totalEvents = chartData.reduce((sum, day) =>
    sum + Object.values(STATUS_LABELS).reduce((daySum, label) => daySum + (Number(day[label]) || 0), 0), 0
  );

  return (
    <div className="card status-trend-chart">
      <div className="status-trend-chart__header">
        <h2 className="card__title">Monthly Status Trend</h2>
        <div className="status-trend-chart__controls">
          <label htmlFor="month-select" className="status-trend-chart__label">Month:</label>
          <input
            id="month-select"
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="status-trend-chart__input"
          />
        </div>
      </div>

      {totalEvents === 0 ? (
        <div className="state state--empty">
          <strong>No activity this month</strong>
          <p>Status events will appear once requests are processed</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              interval={Math.ceil(chartData.length / 10)} // Show ~10 ticks max
            />
            <YAxis />
            <Tooltip
              formatter={(value: unknown, name: unknown) => {
                const numValue = typeof value === 'number' ? value : 0;
                const nameStr = typeof name === 'string' ? name : String(name ?? '');
                return [numValue, nameStr];
              }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '4px' }}
            />
            <Legend />
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Bar
                key={key}
                dataKey={label}
                fill={STATUS_COLORS[key as keyof typeof STATUS_COLORS]}
                name={label}
                stackId="status"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
