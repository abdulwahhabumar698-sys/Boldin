import { auth } from './firebase';

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}
