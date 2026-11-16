import { apiRequest } from './client';
import type { AuthUser } from './types';

export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return result.user;
}

export async function register(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const result = await apiRequest<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
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
