import { Link, useSearchParams } from 'react-router-dom';
import { useInvoices } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { SearchBar } from '../components/SearchBar';
import { formatDate, formatMoney } from '../lib/format';

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = parseInt(params.get('page') || '1', 10);

  const { data, isLoading, isError, error } = useInvoices({
    search: search || undefined,
    page,
  });

  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('search', value);
    else next.delete('search');
    // Reset to page 1 when searching
    next.delete('page');
    setParams(next, { replace: true });
  };

  const setPage = (newPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', newPage.toString());
    setParams(next, { replace: true });
  };

  const invoices = data?.data || [];
  const pagination = data?.pagination;

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Generated automatically when a request is approved.</p>
        </div>
      </header>

      <div className="filters">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by customer name or request title..."
          className="filters__search"
        />
      </div>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} />}
      {invoices.length === 0 && !isLoading && (
        <EmptyState
          title={search ? "No invoices found" : "No invoices yet"}
          hint={
            search
              ? `No invoices match "${search}". Try different search terms.`
              : "Invoices appear here once approved requests are processed."
          }
        />
      )}

      {invoices.length > 0 && (
        <>
          <div className="card table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="table__row">
                    <td>
                      <Link className="link" to={`/invoices/${inv.id}`}>
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td>{inv.billToName || inv.billingRequest.customerName}</td>
                    <td className="num">{formatMoney(inv.amount, inv.currency)}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="muted">{formatDate(inv.issuedAt)}</td>
                    <td className="muted">{formatDate(inv.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination__btn"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span className="pagination__info">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                className="pagination__btn"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
