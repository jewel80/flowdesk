import { Link } from 'react-router-dom';
import { useInvoices } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatMoney } from '../lib/format';

export function InvoicesPage() {
  const { data, isLoading, isError, error } = useInvoices();

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Generated automatically when a request is approved.</p>
        </div>
      </header>

      {isLoading && <LoadingState />}
      {isError && <ErrorState message={extractErrorMessage(error)} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No invoices yet"
          hint="Invoices appear here once approved requests are processed."
        />
      )}

      {data && data.length > 0 && (
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
              {data.map((inv) => (
                <tr key={inv.id} className="table__row">
                  <td>
                    <Link className="link" to={`/invoices/${inv.id}`}>
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td>{inv.billingRequest.customerName}</td>
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
      )}
    </section>
  );
}
