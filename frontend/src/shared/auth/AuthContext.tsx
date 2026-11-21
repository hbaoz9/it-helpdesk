import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from './auth-context';
import { ApiError, UNAUTHORIZED_EVENT } from '../api/client';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from '../api/auth';
import type { AuthUser } from '../api/types';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    setLoading(true);
    setLoadError(null);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return null;
      }
      setLoadError(
        error instanceof Error ? error.message : 'Không thể kết nối Backend',
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setLoadError(null);
        }
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

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    const authenticatedUser = await loginRequest(email.trim(), password, remember);
    setUser(authenticatedUser);
    setLoadError(null);
    return authenticatedUser;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, loadError, login, logout, refreshSession }),
    [user, loading, loadError, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
