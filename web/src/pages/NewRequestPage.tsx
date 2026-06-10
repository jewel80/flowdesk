import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateRequest } from '../api/hooks';
import { extractErrorMessage } from '../api/client';

export function NewRequestPage() {
  const navigate = useNavigate();
  const createRequest = useCreateRequest();

  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const created = await createRequest.mutateAsync({
        title,
        customerName,
        amount: Number(amount),
        currency,
        description: description || undefined,
      });
      navigate(`/requests/${created.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <section className="page page--narrow">
      <header className="page__head">
        <div>
          <h1>New Billing Request</h1>
          <p className="muted">Saved as a draft until you submit it for review.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="card form">
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            placeholder="e.g. Q2 Consulting Retainer"
          />
        </label>
        <label className="field">
          <span>Customer</span>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            placeholder="Customer / company name"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Amount</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
            />
          </label>
          <label className="field field--sm">
            <span>Currency</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              maxLength={3}
              pattern="[A-Za-z]{3}"
            />
          </label>
        </div>
        <label className="field">
          <span>Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Context for the reviewer"
          />
        </label>

        {error && <div className="form__error">{error}</div>}

        <div className="form__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            className="btn btn--primary"
            disabled={createRequest.isPending}
          >
            {createRequest.isPending ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </section>
  );
}
