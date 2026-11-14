import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import { ApiError } from '../api/client';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth';
import type { AuthUser } from '../api/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : 'Không thể kết nối Backend',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const authenticatedUser = await loginRequest(email, password);
    setUser(authenticatedUser);
    setLoadError(null);
    return authenticatedUser;
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const authenticatedUser = await registerRequest(fullName, email, password);
      setUser(authenticatedUser);
      setLoadError(null);
      return authenticatedUser;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, loadError, login, register, logout }),
    [user, loading, loadError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
