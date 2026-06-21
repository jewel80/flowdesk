import { PIStatusChart } from '../components/PIStatusChart';
import { StatusTrendChart } from '../components/StatusTrendChart';

export function PIDashboardPage() {
  return (
    <section className="page page--dashboard">
      <header className="page__head">
        <h1>PI Dashboard</h1>
        <p>Organization-wide billing request performance</p>
      </header>

      <div className="dashboard__overview">
        <PIStatusChart />
      </div>

      <div className="dashboard__trend">
        <StatusTrendChart />
      </div>
    </section>
  );
}
