import { createContext } from 'react';
import type { AuthUser } from '../api/types';

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loadError: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
