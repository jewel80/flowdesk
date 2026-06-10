import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useAuditTrail,
  useBillingRequest,
  useRequestAction,
} from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatMoney, humanise } from '../lib/format';
import type { BillingRequest, WorkflowAction } from '../api/types';

export function RequestDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const request = useBillingRequest(id);
  const audit = useAuditTrail(id);
  const action = useRequestAction();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (request.isLoading) return <LoadingState />;
  if (request.isError || !request.data) {
    return <ErrorState message={extractErrorMessage(request.error)} />;
  }

  const data = request.data;
  const isOwner = user?.userId === data.createdBy.id;

  const can = (a: WorkflowAction): boolean => {
    if (!data.availableActions.includes(a)) return false;
    if (a === 'submit' || a === 'resubmit') {
      return user?.role === 'SALES' && isOwner;
    }
    return user?.role === 'ACCOUNTS'; // approve / reject
  };
  const canEdit = data.status === 'DRAFT' && user?.role === 'SALES' && isOwner;

  const run = async (a: WorkflowAction, payload?: string) => {
    setActionError(null);
    try {
      await action.mutateAsync({ id: data.id, action: a, reason: payload });
      setRejecting(false);
      setReason('');
    } catch (err) {
      setActionError(extractErrorMessage(err));
    }
  };

  return (
    <section className="page">
      <div className="breadcrumb">
        <Link className="link" to="/requests">
          ← Billing Requests
        </Link>
      </div>

      <header className="page__head">
        <div>
          <h1>
            {data.reference} — {data.title}
          </h1>
          <p className="muted">
            Created by {data.createdBy.name} · {formatDate(data.createdAt)}
          </p>
        </div>
        <StatusBadge status={data.status} />
      </header>

      <div className="detail-grid">
        <div className="card">
          <h2 className="card__title">Details</h2>
          <dl className="kv">
            <Field label="Customer" value={data.customerName} />
            <Field label="Amount" value={formatMoney(data.amount, data.currency)} />
            <Field
              label="Description"
              value={data.description || '—'}
            />
            <Field
              label="Reviewed by"
              value={
                data.reviewedBy
                  ? `${data.reviewedBy.name} · ${formatDate(data.reviewedAt)}`
                  : 'Not yet reviewed'
              }
            />
            {data.invoiceId && (
              <div className="kv__row">
                <dt>Invoice</dt>
                <dd>
                  <Link className="link" to={`/invoices/${data.invoiceId}`}>
                    View invoice →
                  </Link>
                </dd>
              </div>
            )}
          </dl>

          {data.status === 'REJECTED' && data.rejectionReason && (
            <div className="callout callout--warn">
              <strong>Rejected:</strong> {data.rejectionReason}
            </div>
          )}

          <ActionBar
            data={data}
            can={can}
            canEdit={canEdit}
            pending={action.isPending}
            onEdit={() => navigate(`/requests/${data.id}/edit`)}
            onRun={run}
            rejecting={rejecting}
            setRejecting={setRejecting}
            reason={reason}
            setReason={setReason}
          />
          {actionError && <div className="form__error">{actionError}</div>}
        </div>

        <div className="card">
          <h2 className="card__title">Activity history</h2>
          {audit.isLoading && <LoadingState label="Loading history…" />}
          {audit.data && (
            <ol className="timeline">
              {audit.data.map((entry) => (
                <li key={entry.id} className="timeline__item">
                  <span className="timeline__dot" aria-hidden />
                  <div className="timeline__body">
                    <span className="timeline__action">
                      {humanise(entry.action)}
                    </span>
                    <span className="timeline__meta">
                      {entry.actor ? entry.actor.name : 'System'} ·{' '}
                      {formatDate(entry.createdAt)}
                    </span>
                    {entry.note && (
                      <span className="timeline__note">{entry.note}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface ActionBarProps {
  data: BillingRequest;
  can: (a: WorkflowAction) => boolean;
  canEdit: boolean;
  pending: boolean;
  onEdit: () => void;
  onRun: (a: WorkflowAction, reason?: string) => void;
  rejecting: boolean;
  setRejecting: (v: boolean) => void;
  reason: string;
  setReason: (v: string) => void;
}

function ActionBar({
  can,
  canEdit,
  pending,
  onEdit,
  onRun,
  rejecting,
  setRejecting,
  reason,
  setReason,
}: ActionBarProps) {
  const hasAnyAction =
    canEdit || can('submit') || can('approve') || can('reject') || can('resubmit');

  if (!hasAnyAction) {
    return <p className="muted actions__none">No actions available to you.</p>;
  }

  return (
    <div className="actions">
      {canEdit && (
        <button className="btn btn--ghost" onClick={onEdit} disabled={pending}>
          Edit
        </button>
      )}
      {can('submit') && (
        <button
          className="btn btn--primary"
          onClick={() => onRun('submit')}
          disabled={pending}
        >
          Submit for review
        </button>
      )}
      {can('resubmit') && (
        <button
          className="btn btn--primary"
          onClick={() => onRun('resubmit')}
          disabled={pending}
        >
          Revise &amp; reopen
        </button>
      )}
      {can('approve') && (
        <button
          className="btn btn--success"
          onClick={() => onRun('approve')}
          disabled={pending}
        >
          Approve
        </button>
      )}
      {can('reject') && !rejecting && (
        <button
          className="btn btn--danger"
          onClick={() => setRejecting(true)}
          disabled={pending}
        >
          Reject
        </button>
      )}
      {can('reject') && rejecting && (
        <div className="reject-box">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason for rejection (required)"
          />
          <div className="reject-box__actions">
            <button
              className="btn btn--ghost"
              onClick={() => setRejecting(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => onRun('reject', reason)}
              disabled={pending || reason.trim().length < 3}
            >
              Confirm rejection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
