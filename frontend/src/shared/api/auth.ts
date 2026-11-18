import { apiRequest } from './client';
import type { AuthUser } from './types';

export async function login(email: string, password: string, remember = false): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember }),
  });
  return result.user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>('/auth/me');
  return result.user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ success: boolean }>('/auth/logout', { method: 'POST' });
}
