import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDemoUsers } from '../api/hooks';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { humanise } from '../lib/format';

const DEMO_PASSWORD = 'password123';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const demoUsers = useDemoUsers();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="brand brand--lg">
          <span className="brand__mark">FD</span>
          <span className="brand__name">FlowDesk</span>
        </div>
        <p className="login__subtitle">Billing Approval Workflow</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="form__error">{error}</div>}
          <button className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login__demo">
          <p>Demo accounts (password: <code>{DEMO_PASSWORD}</code>)</p>
          <div className="login__demo-list">
            {demoUsers.data?.map((u) => (
              <button
                key={u.id}
                type="button"
                className="demo-user"
                onClick={() => quickFill(u.email)}
              >
                <span className="demo-user__name">{u.name}</span>
                <span className="badge badge--role">{humanise(u.role)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
