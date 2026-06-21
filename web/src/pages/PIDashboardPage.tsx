import { PIStatusChart } from '../components/PIStatusChart';
import { DashboardTimeline } from '../components/DashboardTimeline';
import { useDashboardTimeline } from '../api/hooks';

export function PIDashboardPage() {
  const timeline = useDashboardTimeline(30); // Last 30 days

  return (
    <section className="page page--dashboard">
      <header className="page__head">
        <h1>PI Dashboard</h1>
        <p>Organization-wide billing request performance</p>
      </header>

      <div className="dashboard__overview">
        <PIStatusChart />
      </div>

      <div className="dashboard__timeline">
        <h2>Daily Activity Timeline</h2>
        <DashboardTimeline
          groups={timeline.data || []}
          isLoading={timeline.isLoading}
        />
      </div>
    </section>
  );
}
