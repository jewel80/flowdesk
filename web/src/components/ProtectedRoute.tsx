import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LoadingState } from './States';

/** Gates routes behind an authenticated session. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initialising } = useAuth();

  if (initialising) {
    return <LoadingState label="Restoring session…" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
