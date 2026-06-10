import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBillingRequest, useUpdateRequest } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { ErrorState, LoadingState } from '../components/States';

export function EditRequestPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const request = useBillingRequest(id);
  const update = useUpdateRequest(id);

  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prefill once the request loads.
  useEffect(() => {
    if (request.data) {
      setTitle(request.data.title);
      setCustomerName(request.data.customerName);
      setAmount(String(request.data.amount));
      setDescription(request.data.description ?? '');
    }
  }, [request.data]);

  if (request.isLoading) return <LoadingState />;
  if (request.isError || !request.data) {
    return <ErrorState message={extractErrorMessage(request.error)} />;
  }
  if (request.data.status !== 'DRAFT') {
    return (
      <ErrorState message="Only draft requests can be edited." />
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        title,
        customerName,
        amount: Number(amount),
        description: description || undefined,
      });
      navigate(`/requests/${id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <section className="page page--narrow">
      <header className="page__head">
        <h1>Edit {request.data.reference}</h1>
      </header>
      <form onSubmit={handleSubmit} className="card form">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
        </label>
        <label className="field">
          <span>Customer</span>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </label>
        {error && <div className="form__error">{error}</div>}
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
