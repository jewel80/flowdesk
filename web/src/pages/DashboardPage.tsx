import { Link } from 'react-router-dom';
import { useMetrics } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
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
  const { data, isLoading, isError, error } = useMetrics();

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState message={extractErrorMessage(error)} />;

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            {data.scope === 'self'
              ? 'Your billing requests at a glance.'
              : 'Organisation-wide billing overview.'}
          </p>
        </div>
        {user?.role === 'SALES' && (
          <Link className="btn btn--primary" to="/requests/new">
            New request
          </Link>
        )}
      </header>

      <div className="cards">
        <div className="card metric">
          <span className="metric__label">Total requests</span>
          <span className="metric__value">{data.requests.total}</span>
        </div>
        <div className="card metric">
          <span className="metric__label">Pending review</span>
          <span className="metric__value">{data.requests.pendingReview}</span>
        </div>
        <div className="card metric">
          <span className="metric__label">Outstanding invoices</span>
          <span className="metric__value">
            {formatMoney(data.invoices.outstandingAmount, 'USD')}
          </span>
          <span className="metric__sub">
            {data.invoices.outstandingCount} unpaid
          </span>
        </div>
        <div className="card metric">
          <span className="metric__label">Collected</span>
          <span className="metric__value">
            {formatMoney(data.invoices.paidAmount, 'USD')}
          </span>
          <span className="metric__sub">{data.invoices.paidCount} paid</span>
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">Requests by status</h2>
        <div className="status-grid">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              to={`/requests?status=${status}`}
              className="status-grid__item"
            >
              <StatusBadge status={status} />
              <span className="status-grid__count">
                {data.requests.byStatus[status]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
