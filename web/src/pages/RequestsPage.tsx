import { Link, useSearchParams } from 'react-router-dom';
import { useBillingRequests } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { formatMoney, formatDate } from '../lib/format';
import type { BillingRequestStatus } from '../api/types';

const STATUSES: BillingRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'INVOICED',
];

export function RequestsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';

  const { data, isLoading, isError, error } = useBillingRequests({
    status: status || undefined,
  });

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h1>Billing Requests</h1>
          <p className="muted">
            {user?.role === 'SALES'
              ? 'Requests you have created.'
              : 'All requests across the organisation.'}
          </p>
        </div>
        {user?.role === 'SALES' && (
          <Link className="btn btn--primary" to="/requests/new">
            New request
          </Link>
        )}
      </header>

      <div className="filters">
        <button
          className={`chip ${status === '' ? 'chip--active' : ''}`}
          onClick={() => setStatus('')}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`chip ${status === s ? 'chip--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} />}

      {data && data.data.length === 0 && (
        <EmptyState
          title="No requests found"
          hint={
            status
              ? `There are no requests with status ${status}.`
              : 'Create your first billing request to get started.'
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Created by</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((req) => (
                <tr key={req.id} className="table__row">
                  <td>
                    <Link className="link" to={`/requests/${req.id}`}>
                      {req.reference}
                    </Link>
                  </td>
                  <td>{req.title}</td>
                  <td>{req.customerName}</td>
                  <td className="num">{formatMoney(req.amount, req.currency)}</td>
                  <td>
                    <StatusBadge status={req.status} />
                  </td>
                  <td>{req.createdBy.name}</td>
                  <td className="muted">{formatDate(req.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
