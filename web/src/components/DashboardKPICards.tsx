import { useMonthlyStatusTrends, usePIStatusSummary } from '../api/hooks';
import { LoadingState } from './States';

type Trend = { dir: 'up' | 'down' | 'flat'; pct: number };

function mkTrend(curr: number, prev: number): Trend {
  if (prev === 0 && curr === 0) return { dir: 'flat', pct: 0 };
  if (prev === 0) return { dir: 'up', pct: 100 };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { dir: pct > 3 ? 'up' : pct < -3 ? 'down' : 'flat', pct: Math.abs(pct) };
}

interface KPICardProps {
  label: string;
  value: number;
  color: 'indigo' | 'amber' | 'green' | 'red';
  trend?: Trend;
}

function KPICard({ label, value, color, trend }: KPICardProps) {
  return (
    <div className={`kpi-card kpi-card--${color}`}>
      <div className="kpi-card__value">{value.toLocaleString()}</div>
      <div className="kpi-card__label">{label}</div>
      {trend && trend.dir !== 'flat' && (
        <div className={`kpi-card__trend kpi-card__trend--${trend.dir}`}>
          {trend.dir === 'up' ? '↑' : '↓'} {trend.pct}% vs last month
        </div>
      )}
    </div>
  );
}

export function DashboardKPICards() {
  const { data: summary, isLoading } = usePIStatusSummary();
  const { results } = useMonthlyStatusTrends(2);

  const sumMonth = (idx: number) => {
    const days = results[idx]?.data?.days ?? [];
    return {
      submitted: days.reduce((s, d) => s + (d.SUBMITTED ?? 0), 0),
      approved:  days.reduce((s, d) => s + (d.APPROVED  ?? 0), 0),
      rejected:  days.reduce((s, d) => s + (d.REJECTED  ?? 0), 0),
      total:     days.reduce((s, d) => s + (d.SUBMITTED ?? 0) + (d.APPROVED ?? 0) + (d.REJECTED ?? 0) + (d.INVOICED ?? 0), 0),
    };
  };

  const prev = sumMonth(0);
  const curr = sumMonth(1);

  if (isLoading) return <LoadingState label="Loading summary…" />;

  const submitted = summary?.SUBMITTED ?? 0;
  const approved  = summary?.APPROVED  ?? 0;
  const rejected  = summary?.REJECTED  ?? 0;
  const invoiced  = summary?.INVOICED  ?? 0;
  const total     = submitted + approved + rejected + invoiced;

  return (
    <div className="kpi-grid">
      <KPICard label="Total PI"    value={total}     color="indigo" trend={mkTrend(curr.total,     prev.total)} />
      <KPICard label="Pending PI"  value={submitted} color="amber"  trend={mkTrend(curr.submitted, prev.submitted)} />
      <KPICard label="Approved PI" value={approved}  color="green"  trend={mkTrend(curr.approved,  prev.approved)} />
      <KPICard label="Rejected PI" value={rejected}  color="red"    trend={mkTrend(curr.rejected,  prev.rejected)} />
    </div>
  );
}
