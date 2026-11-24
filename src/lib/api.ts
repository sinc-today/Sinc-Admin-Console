import { isMarketPath, marketApiPath } from './market';
/** Browser-side client for the admin service. Same-origin, cookie session. */

export interface Envelope<T> {
  statusCode: string;
  message: string;
  data?: T;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  // On /market pages, organizer and event calls go to the partner-limited /market API (see lib/market.ts).
  if (typeof window !== 'undefined' && isMarketPath(window.location.pathname)) path = marketApiPath(path, window.location.search);
  let res: Response;
  try {
    res = await fetch(`/admin-api/v1${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Couldn't reach the admin service. Check your connection and retry.", 0);
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const reason = encodeURIComponent(body?.message || '');
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}&reason=${reason}`);
    }
    throw new ApiError(body?.message || 'Something went wrong', res.status, res.headers.get('x-request-id') || body?.requestId);
  }
  return body?.data as T;
}
