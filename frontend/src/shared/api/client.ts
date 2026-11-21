const API_BASE_URL = '/api/v1';

export const UNAUTHORIZED_EVENT = 'smartdesk:unauthorized';

export class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
      ) {
        message = body.message;
      } else if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        Array.isArray(body.message)
      ) {
        message = body.message.join(', ');
      }
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }

    if (
      response.status === 401 &&
      path !== '/auth/login' &&
      path !== '/auth/me' &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
