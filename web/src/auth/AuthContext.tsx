import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, tokenStore } from '../api/client';
import type { AuthUser, LoginResponse } from '../api/types';

interface AuthContextValue {
  user: AuthUser | null;
  initialising: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  // Rehydrate the session from a stored token on first load.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setInitialising(false);
      return;
    }
    api
      .get<AuthUser>('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        tokenStore.clear();
        setUser(null);
      })
      .finally(() => setInitialising(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    tokenStore.set(data.accessToken);
    setUser(data.user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, initialising, login, logout }),
    [user, initialising],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
