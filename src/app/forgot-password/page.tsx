'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, inputClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

/** Step 1 of forgot password: email a one-time link. Same answer whether or not the email has access. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/password/forgot', { method: 'POST', json: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div role="status">
          <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Check your email</h1>
          <p className="mt-3 text-[14px] text-ink-secondary">
            If <span className="text-ink">{email.trim()}</span> has console access, a reset link is on its way. It works once and expires in 30 minutes.
          </p>
          <p className="mt-3 text-[13px] text-ink-muted">Nothing after a few minutes? Check spam, or ask an owner to confirm the email on your staff profile.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="display inline-flex h-10 items-center bg-ink px-5 text-[16px] text-canvas hover:bg-ink-secondary">
              Back to sign in
            </Link>
            <Button variant="secondary" onClick={() => setSent(false)}>
              Use another email
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Reset password</h1>
          <p className="mt-2 text-[14px] text-ink-secondary">We&apos;ll email you a link to choose a new one.</p>
          <div className="mt-8 flex flex-col gap-5">
            <Field label="Email" htmlFor="fp-email" error={error ?? undefined}>
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                className={inputClass}
                placeholder="name@sinc.today"
                autoFocus
              />
            </Field>
            <Button type="submit" loading={busy} loadingText="Sending…" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} className="w-full">
              Send reset link
            </Button>
            <Link href="/login" className="text-center text-[13px] text-ink-secondary underline underline-offset-4 hover:text-ink">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
