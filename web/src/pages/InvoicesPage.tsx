import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInvoices, useMetrics } from '../api/hooks';
import { api, extractErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { SearchBar } from '../components/SearchBar';
import { Pagination } from '../components/Pagination';
import { formatDate, formatMoney } from '../lib/format';
import type { Invoice, InvoiceStatus } from '../api/types';

type SortField = 'invoiceNumber' | 'billToName' | 'amount' | 'status' | 'issuedAt' | 'dueDate';
type SortDir   = 'asc' | 'desc';

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All',        value: '' },
  { label: 'Issued',     value: 'ISSUED' },
  { label: 'Paid',       value: 'PAID' },
  { label: 'Void',       value: 'VOID' },
];

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="sort-icon sort-icon--idle">↕</span>;
  return <span className="sort-icon sort-icon--active">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function InvoiceStatCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="invoice-stat-card">
      <span className="invoice-stat-card__label">{label}</span>
      <span className="invoice-stat-card__value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className="invoice-stat-card__sub">{sub}</span>}
    </div>
  );
}

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const search     = params.get('search') ?? '';
  const page       = parseInt(params.get('page') || '1', 10);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortField, setSortField]       = useState<SortField>('issuedAt');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [dlError, setDlError]           = useState<string | null>(null);

  const { data, isLoading, isError, error } = useInvoices({ search: search || undefined, page });
  const metrics = useMetrics();

  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('search', value); else next.delete('search');
    next.delete('page');
    setStatusFilter('');
    setParams(next, { replace: true });
  };

  const setPage = (newPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', newPage.toString());
    setParams(next, { replace: true });
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleDownload = async (inv: Invoice) => {
    setDlError(null);
    try {
      const res = await api.get<Blob>(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDlError('PDF download failed. Please try again.');
    }
  };

  // Client-side status filter + sort on current page
  const invoices = useMemo(() => {
    const raw = data?.data ?? [];
    const filtered = statusFilter ? raw.filter(i => i.status === statusFilter) : raw;
    return [...filtered].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortField) {
        case 'invoiceNumber': av = a.invoiceNumber;                 bv = b.invoiceNumber;                 break;
        case 'billToName':    av = (a.billToName ?? '').toLowerCase(); bv = (b.billToName ?? '').toLowerCase(); break;
        case 'amount':        av = a.amount;                        bv = b.amount;                        break;
        case 'status':        av = a.status;                        bv = b.status;                        break;
        case 'issuedAt':      av = a.issuedAt;                      bv = b.issuedAt;                      break;
        case 'dueDate':       av = a.dueDate;                       bv = b.dueDate;                       break;
        default:              return 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [data, statusFilter, sortField, sortDir]);

  const pagination   = data?.pagination;
  const invMetrics   = metrics.data?.invoices;
  const totalCount   = pagination?.total ?? 0;
  const today        = new Date().toISOString().slice(0, 10);
  const overdueCount = (data?.data ?? []).filter(
    i => i.status === 'ISSUED' && i.dueDate < today
  ).length;

  const Th = ({ field, children, align }: { field: SortField; children: React.ReactNode; align?: string }) => (
    <th
      className={`sortable-th${align === 'right' ? ' num' : ''}`}
      onClick={() => handleSort(field)}
    >
      {children}
      <SortIcon active={sortField === field} dir={sortDir} />
    </th>
  );

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Generated automatically when a request is approved.</p>
        </div>
      </header>

      {/* Summary cards */}
      {!metrics.isLoading && invMetrics && (
        <div className="invoice-stats">
          <InvoiceStatCard
            label="Total Invoices"
            value={String(totalCount)}
          />
          <InvoiceStatCard
            label="Paid"
            value={formatMoney(invMetrics.paidAmount, 'USD')}
            sub={`${invMetrics.paidCount} invoice${invMetrics.paidCount !== 1 ? 's' : ''}`}
            accent="#059669"
          />
          <InvoiceStatCard
            label="Outstanding"
            value={formatMoney(invMetrics.outstandingAmount, 'USD')}
            sub={`${invMetrics.outstandingCount} invoice${invMetrics.outstandingCount !== 1 ? 's' : ''}`}
            accent="#d97706"
          />
          {overdueCount > 0 && (
            <InvoiceStatCard
              label="Overdue (this page)"
              value={String(overdueCount)}
              sub="past due date"
              accent="#dc2626"
            />
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters filters--invoices">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by customer, invoice #, or title…"
          className="filters__search"
        />
        <div className="filters__status-group">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={`chip ${statusFilter === f.value ? 'chip--active' : ''}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {dlError && <div className="form__error" style={{ marginBottom: 12 }}>{dlError}</div>}

      {isLoading && <LoadingState />}
      {isError   && <ErrorState message={extractErrorMessage(error)} />}

      {!isLoading && invoices.length === 0 && (
        <EmptyState
          title={search || statusFilter ? 'No invoices found' : 'No invoices yet'}
          hint={
            search
              ? `No invoices match "${search}".`
              : statusFilter
              ? `No ${statusFilter.toLowerCase()} invoices on this page.`
              : 'Invoices appear here once approved requests are processed.'
          }
        />
      )}

      {invoices.length > 0 && (
        <>
          <div className="card table-card invoices-table-card">
            <table className="table invoices-table">
              <thead>
                <tr>
                  <Th field="invoiceNumber">Invoice #</Th>
                  <Th field="billToName">Customer</Th>
                  <Th field="amount" align="right">Amount</Th>
                  <Th field="status">Status</Th>
                  <Th field="issuedAt">Issued</Th>
                  <Th field="dueDate">Due</Th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isOverdue = inv.status === 'ISSUED' && inv.dueDate < today;
                  return (
                    <tr key={inv.id} className={`table__row${isOverdue ? ' table__row--overdue' : ''}`}>
                      <td>
                        <Link className="link invoice-link" to={`/invoices/${inv.id}`}>
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="invoice-customer">
                        {inv.billToName || inv.billingRequest.customerName}
                      </td>
                      <td className="num invoice-amount">
                        {formatMoney(inv.amount, inv.currency)}
                      </td>
                      <td>
                        <StatusBadge status={inv.status as InvoiceStatus} />
                        {isOverdue && <span className="overdue-tag">Overdue</span>}
                      </td>
                      <td className="muted">{formatDate(inv.issuedAt)}</td>
                      <td className={isOverdue ? 'overdue-date' : 'muted'}>
                        {formatDate(inv.dueDate)}
                      </td>
                      <td>
                        <div className="invoice-actions">
                          <Link
                            className="inv-btn inv-btn--view"
                            to={`/invoices/${inv.id}`}
                            title="View invoice"
                          >
                            View
                          </Link>
                          <button
                            className="inv-btn inv-btn--pdf"
                            onClick={() => handleDownload(inv)}
                            title="Download PDF"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && !statusFilter && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </section>
  );
}
