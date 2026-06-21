import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useMetrics } from '../api/hooks';
import { StatusTrendChart } from '../components/StatusTrendChart';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState } from '../components/States';
import { extractErrorMessage } from '../api/client';
import { formatMoney } from '../lib/format';
import type { BillingRequestStatus } from '../api/types';

const STATUS_ORDER: BillingRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'INVOICED',
];

export function DashboardPage() {
  const { user } = useAuth();
  const metrics = useMetrics();

  return (
    <section className="page page--overview">
      <header className="page__head">
        <div>
          <h1>Overview</h1>
          <p className="muted">
            {metrics.data?.scope === 'self'
              ? 'Your billing operations at a glance.'
              : 'Organisation-wide billing operations.'}
          </p>
        </div>
        {user?.role === 'SALES' && (
          <Link className="btn btn--primary" to="/requests/new">
            New request
          </Link>
        )}
      </header>

      {/* Financial summary + Status breakdown */}
      {metrics.isError ? (
        <ErrorState message={extractErrorMessage(metrics.error)} />
      ) : metrics.data ? (
        <div className="overview__mid">
          <div className="card overview__finance">
            <h2 className="card__title">Financial Summary</h2>
            <div className="finance-list">
              <div className="finance-item finance-item--amber">
                <span className="finance-item__label">Outstanding</span>
                <span className="finance-item__value">
                  {formatMoney(metrics.data.invoices.outstandingAmount, 'USD')}
                </span>
                <span className="finance-item__sub">
                  {metrics.data.invoices.outstandingCount} unpaid invoice
                  {metrics.data.invoices.outstandingCount !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="finance-item finance-item--green">
                <span className="finance-item__label">Collected</span>
                <span className="finance-item__value">
                  {formatMoney(metrics.data.invoices.paidAmount, 'USD')}
                </span>
                <span className="finance-item__sub">
                  {metrics.data.invoices.paidCount} paid invoice
                  {metrics.data.invoices.paidCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="card overview__status">
            <h2 className="card__title">Requests by Status</h2>
            <div className="status-grid">
              {STATUS_ORDER.map((status) => (
                <Link
                  key={status}
                  to={`/requests?status=${status}`}
                  className="status-grid__item"
                >
                  <StatusBadge status={status} />
                  <span className="status-grid__count">
                    {metrics.data.requests.byStatus[status] ?? 0}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Monthly trend chart */}
      <StatusTrendChart />
    </section>
  );
}
