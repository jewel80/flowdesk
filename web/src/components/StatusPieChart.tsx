import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useDailyStatusBreakdown } from '../api/hooks';
import { LoadingState, ErrorState } from './States';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/statusColors';

export function StatusPieChart() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  });

  const { data, isLoading, isError, error } = useDailyStatusBreakdown(selectedDate);

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(event.target.value);
  };

  if (isLoading) return <LoadingState label="Loading status breakdown…" />;
  if (isError) return <ErrorState message={error?.message || 'Failed to load breakdown data'} />;

  const chartData = data
    ? Object.entries(STATUS_LABELS).map(([status, label]) => ({
        name: label,
        value: (data[status as keyof typeof data] || 0) as number,
        color: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
      }))
    : [];

  const total = chartData.reduce((sum, entry) => sum + (entry.value as number), 0);

  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="card status-pie-chart">
      <div className="status-pie-chart__header">
        <h2 className="card__title">Status Snapshot</h2>
        <div className="status-pie-chart__controls">
          <label htmlFor="date-select" className="status-pie-chart__label">Date:</label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="status-pie-chart__input"
            max={new Date().toISOString().slice(0, 10)} // Prevent future dates
          />
        </div>
      </div>

      <div className="status-pie-chart__date">
        <span className="muted">{formattedDate}</span>
      </div>

      {total === 0 ? (
        <div className="state state--empty">
          <strong>No activity on this date</strong>
          <p>Select a different date to see status breakdown</p>
        </div>
      ) : (
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
                const numValue = typeof value === 'number' ? value : 0;
                const nameStr = typeof name === 'string' ? name : String(name ?? '');
                return [
                  `${numValue} (${numValue > 0 ? ((numValue / total) * 100).toFixed(1) : '0.0'}%)`,
                  nameStr,
                ];
              }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '4px' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
