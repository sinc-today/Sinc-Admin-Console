import 'server-only';
import { cookies, headers } from 'next/headers';

const ADMIN_API = process.env.ADMIN_API_URL || 'http://localhost:8005';

export interface StaffMe {
  staff: {
    id: number;
    userId: number;
    displayName: string;
    /** Their Sinc profile picture, if any. */
    imageUrl?: string | null;
    email: string;
    role: { key: string; name: string };
    /** Set for licence-partner users, who only see the partner dashboard. */
    partnerId?: number | null;
    lastLoginAt: string | null;
  };
  permissions: string[];
  session: { expiresAt: string };
}

/**
 * Server-side call to the admin service, forwarding the session cookie.
 * Returns { status, data } so pages can decide between redirect, 403 and error states.
 */
export async function serverApi<T>(path: string): Promise<{ status: number; data: T | null; message?: string; requestId?: string }> {
  const jar = await cookies();
  const sid = jar.get('sinc_admin_sid')?.value;
  const h = await headers();
  try {
    const res = await fetch(`${ADMIN_API}/admin-api/v1${path}`, {
      headers: {
        ...(sid ? { cookie: `sinc_admin_sid=${sid}` } : {}),
        'x-forwarded-for': h.get('x-forwarded-for') || '',
        'user-agent': h.get('user-agent') || '',
      },
      cache: 'no-store',
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, data: res.ok ? (body?.data as T) : null, message: body?.message, requestId: res.headers.get('x-request-id') || undefined };
  } catch {
    return { status: 503, data: null, message: "Couldn't reach the admin service." };
  }
}
