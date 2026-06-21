import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInvoice, useMarkInvoicePaid } from '../api/hooks';
import { api, extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { PIChat } from '../components/PIChat';
import { formatDate, formatMoney } from '../lib/format';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const invoice = useInvoice(id);
  const markPaid = useMarkInvoicePaid();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (invoice.isLoading) return <LoadingState />;
  if (invoice.isError || !invoice.data) {
    return <ErrorState message={extractErrorMessage(invoice.error)} />;
  }

  const data = invoice.data;
  const canMarkPaid = user?.role === 'ACCOUNTS' && data.status === 'ISSUED';
  const canViewPIChat = user?.role === 'MANAGER';

  const handleMarkPaid = async () => {
    setActionError(null);
    try {
      await markPaid.mutateAsync(data.id);
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  const handleDownloadPdf = async () => {
    setPdfError(null);
    setIsDownloading(true);
    try {
      const response = await api.get<Blob>(`/invoices/${data.id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setPdfError('PDF export is not available at this time.');
    } finally {
      setIsDownloading(false);
    }
  };

  const hasBankDetails =
    data.paymentTerms || data.bankName || data.bankAccountName || data.bankAccountNumber || data.bankSwiftOrRouting;

  return (
    <section className="page">
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
        <div className="invoice-header-actions">
          <StatusBadge status={data.status} />
          <button
            className="btn btn--ghost"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            {isDownloading ? 'Downloading…' : 'Download PDF'}
          </button>
          {canMarkPaid && (
            <button
              className="btn btn--success"
              onClick={handleMarkPaid}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? 'Updating…' : 'Mark as paid'}
            </button>
          )}
        </div>
      </header>

      {(pdfError || actionError) && (
        <div className="form__error">{pdfError ?? actionError}</div>
      )}

      <div className={canViewPIChat ? 'detail-grid' : undefined}>
        {/* ── Invoice document ── */}
        <div className="card invoice-doc">

          {/* Header: issuer (left) | invoice meta (right) */}
          <div className="invoice-doc__header">
            <div className="invoice-doc__issuer">
              {data.issuerName && (
                <strong className="invoice-doc__company">{data.issuerName}</strong>
              )}
              {data.issuerAddress && (
                <p className="muted invoice-doc__address">{data.issuerAddress}</p>
              )}
              {data.issuerTaxId && (
                <p className="muted">Tax ID: {data.issuerTaxId}</p>
              )}
              {data.issuerEmail && <p className="muted">{data.issuerEmail}</p>}
              {data.issuerPhone && <p className="muted">{data.issuerPhone}</p>}
            </div>
            <div>
              <dl className="kv">
                <div className="kv__row">
                  <dt>Invoice date</dt>
                  <dd>{formatDate(data.issuedAt)}</dd>
                </div>
                <div className="kv__row">
                  <dt>Due date</dt>
                  <dd>{formatDate(data.dueDate)}</dd>
                </div>
                {data.paidAt && (
                  <div className="kv__row">
                    <dt>Paid</dt>
                    <dd>{formatDate(data.paidAt)}</dd>
                  </div>
                )}
                <div className="kv__row">
                  <dt>Source request</dt>
                  <dd>
                    <Link className="link" to={`/requests/${data.billingRequest.id}`}>
                      View request →
                    </Link>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Bill-to */}
          <div className="invoice-doc__section">
            <h3 className="invoice-doc__section-label">Bill To</h3>
            <strong className="invoice-doc__company">{data.billToName}</strong>
            {data.billToAddress && (
              <p className="muted invoice-doc__address">{data.billToAddress}</p>
            )}
            {data.billToEmail && <p className="muted">{data.billToEmail}</p>}
            {data.billToPhone && <p className="muted">{data.billToPhone}</p>}
          </div>

          {/* Line items */}
          {data.lineItems.length > 0 && (
            <div className="invoice-doc__section">
              <div className="table-card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit Price</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lineItems.map((item) => (
                      <tr key={item.id} className="table__row">
                        <td>{item.description}</td>
                        <td className="num">{item.quantity}</td>
                        <td className="num">
                          {formatMoney(item.unitPrice, data.currency)}
                        </td>
                        <td className="num">
                          {formatMoney(item.amount, data.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="invoice-doc__totals">
            <div className="totals__row">
              <span>Subtotal</span>
              <span>{formatMoney(data.subtotal, data.currency)}</span>
            </div>
            {data.discount > 0 && (
              <div className="totals__row">
                <span>Discount</span>
                <span>−{formatMoney(data.discount, data.currency)}</span>
              </div>
            )}
            {data.taxRatePercent > 0 && (
              <div className="totals__row">
                <span>Tax ({data.taxRatePercent}%)</span>
                <span>{formatMoney(data.taxAmount, data.currency)}</span>
              </div>
            )}
            <div className="totals__row totals__row--grand">
              <span>Total Due</span>
              <span>{formatMoney(data.total, data.currency)}</span>
            </div>
          </div>

          {/* Payment terms + bank details (conditional) */}
          {hasBankDetails && (
            <div className="invoice-doc__section">
              <h3 className="invoice-doc__section-label">Payment Details</h3>
              <dl className="kv">
                {data.paymentTerms && (
                  <div className="kv__row">
                    <dt>Payment terms</dt>
                    <dd>{data.paymentTerms}</dd>
                  </div>
                )}
                {data.bankName && (
                  <div className="kv__row">
                    <dt>Bank</dt>
                    <dd>{data.bankName}</dd>
                  </div>
                )}
                {data.bankAccountName && (
                  <div className="kv__row">
                    <dt>Account name</dt>
                    <dd>{data.bankAccountName}</dd>
                  </div>
                )}
                {data.bankAccountNumber && (
                  <div className="kv__row">
                    <dt>Account number</dt>
                    <dd>{data.bankAccountNumber}</dd>
                  </div>
                )}
                {data.bankSwiftOrRouting && (
                  <div className="kv__row">
                    <dt>SWIFT / Routing</dt>
                    <dd>{data.bankSwiftOrRouting}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Notes / terms */}
          {data.notes && (
            <div className="invoice-doc__section">
              <h3 className="invoice-doc__section-label">Notes</h3>
              <p className="muted">{data.notes}</p>
            </div>
          )}
        </div>

        {/* ── PI Chat (Manager only) ── */}
        {canViewPIChat && (
          <div className="card pi-chat-card">
            <h2 className="card__title">PI Chat</h2>
            <PIChat invoiceId={id} />
          </div>
        )}
      </div>
    </section>
  );
}
