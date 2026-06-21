import { Link, useSearchParams } from 'react-router-dom';
import { useBillingRequests } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { SearchBar } from '../components/SearchBar';
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
  const search = params.get('search') ?? '';

  const { data, isLoading, isError, error } = useBillingRequests({
    status: status || undefined,
    search: search || undefined,
  });

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    // Reset to page 1 when changing filters
    next.delete('page');
    setParams(next, { replace: true });
  };

  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('search', value);
    else next.delete('search');
    // Reset to page 1 when searching
    next.delete('page');
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
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by title or customer name..."
          className="filters__search"
        />
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
            search
              ? `No requests match "${search}". Try different search terms.`
              : status
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
