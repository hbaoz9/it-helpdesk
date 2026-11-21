import { createContext } from 'react';
import type { AuthUser } from '../api/types';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loadError: string | null;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
