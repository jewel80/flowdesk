import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInvoice, useMarkInvoicePaid } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatMoney } from '../lib/format';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const invoice = useInvoice(id);
  const markPaid = useMarkInvoicePaid();
  const [error, setError] = useState<string | null>(null);

  if (invoice.isLoading) return <LoadingState />;
  if (invoice.isError || !invoice.data) {
    return <ErrorState message={extractErrorMessage(invoice.error)} />;
  }

  const data = invoice.data;
  const canMarkPaid = user?.role === 'ACCOUNTS' && data.status === 'ISSUED';

  const handleMarkPaid = async () => {
    setError(null);
    try {
      await markPaid.mutateAsync(data.id);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <section className="page page--narrow">
      <div className="breadcrumb">
        <Link className="link" to="/invoices">
          ← Invoices
        </Link>
      </div>

      <header className="page__head">
        <div>
          <h1>{data.invoiceNumber}</h1>
          <p className="muted">{data.billingRequest.title}</p>
        </div>
        <StatusBadge status={data.status} />
      </header>

      <div className="card invoice">
        <div className="invoice__amount">
          {formatMoney(data.amount, data.currency)}
        </div>
        <dl className="kv">
          <div className="kv__row">
            <dt>Customer</dt>
            <dd>{data.billingRequest.customerName}</dd>
          </div>
          <div className="kv__row">
            <dt>Issued</dt>
            <dd>{formatDate(data.issuedAt)}</dd>
          </div>
          <div className="kv__row">
            <dt>Due date</dt>
            <dd>{formatDate(data.dueDate)}</dd>
          </div>
          <div className="kv__row">
            <dt>Paid at</dt>
            <dd>{formatDate(data.paidAt)}</dd>
          </div>
          <div className="kv__row">
            <dt>Source request</dt>
            <dd>
              <Link className="link" to={`/requests/${data.billingRequest.id}`}>
                View request →
              </Link>
            </dd>
          </div>
        </dl>

        {canMarkPaid && (
          <div className="actions">
            <button
              className="btn btn--success"
              onClick={handleMarkPaid}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? 'Updating…' : 'Mark as paid'}
            </button>
          </div>
        )}
        {error && <div className="form__error">{error}</div>}
      </div>
    </section>
  );
}
