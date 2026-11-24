'use client';

import { Eye, EyeSlash } from '@phosphor-icons/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

// Same rules as the Sinc app (the account is shared).
const RULES: { label: string; ok: (p: string) => boolean }[] = [
  { label: '8 or more characters', ok: (p) => p.length >= 8 },
  { label: 'A letter and a digit', ok: (p) => /[a-zA-Z]/.test(p) && /\d/.test(p) },
  { label: 'One of @ # $ % ^ & ! _', ok: (p) => /[@#$%^&!_]/.test(p) },
  { label: 'Starts with a letter or digit', ok: (p) => /^[a-zA-Z0-9]/.test(p) },
];

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Reset />
    </Suspense>
  );
}

function Reset() {
  const params = useSearchParams();
  const [token] = useState(() => params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Take the token out of the address bar and history once it is in memory.
  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/reset-password');
  }, [token]);

  const allOk = RULES.every((r) => r.ok(password));
  const matches = password.length > 0 && password === confirm;
  const linkProblem = !!error && /link/i.test(error);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/auth/password/reset', { method: 'POST', json: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!token)
    return (
      <AuthShell>
        <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Link not valid</h1>
        <p className="mt-3 text-[14px] text-ink-secondary">Open the link from the email again, or ask for a new one.</p>
        <Link href="/forgot-password" className="display mt-8 inline-flex h-10 items-center bg-ink px-5 text-[16px] text-canvas hover:bg-ink-secondary">
          Ask for a new link
        </Link>
      </AuthShell>
    );

  if (done)
    return (
      <AuthShell>
        <div role="status">
          <StatusBadge status="ok">Password changed</StatusBadge>
          <h1 className="display mt-4 text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">You&apos;re set</h1>
          <p className="mt-3 text-[14px] text-ink-secondary">Sign in with your new password. It also works in the Sinc app. Your two-factor code is unchanged, and other console sessions were signed out.</p>
          <Link href="/login" className="display mt-8 inline-flex h-10 items-center bg-ink px-5 text-[16px] text-canvas hover:bg-ink-secondary">
            Sign in
          </Link>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate>
        <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">New password</h1>
        <p className="mt-2 text-[14px] text-ink-secondary">For your Sinc account, in the console and the app.</p>
        <div className="mt-8 flex flex-col gap-5">
          <Field label="New password" htmlFor="rp-password">
            <div className="relative">
              <input
                id="rp-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="rp-rules"
                className={`${inputClass} pr-11`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                title={show ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center text-ink-muted hover:text-ink"
              >
                {show ? <EyeSlash size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          </Field>
          <ul id="rp-rules" className="-mt-2 grid grid-cols-1 gap-1 text-[12px] sm:grid-cols-2" aria-label="Password rules">
            {RULES.map((r) => {
              const ok = r.ok(password);
              return (
                <li key={r.label} className={ok ? 'text-ink' : 'text-ink-muted'}>
                  <span aria-hidden>{ok ? '✓' : '·'}</span> {r.label}
                  <span className="sr-only">{ok ? ' (done)' : ' (not yet)'}</span>
                </li>
              );
            })}
          </ul>
          <Field label="Confirm password" htmlFor="rp-confirm" error={confirm && !matches ? "Passwords don't match" : undefined}>
            <input
              id="rp-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={Boolean(confirm && !matches)}
              className={inputClass}
            />
          </Field>
          {error && (
            <p role="alert" className="text-[13px] text-ember-ink">
              {error}{' '}
              {linkProblem && (
                <Link href="/forgot-password" className="underline underline-offset-4">
                  Ask for a new link
                </Link>
              )}
            </p>
          )}
          <Button type="submit" loading={busy} loadingText="Saving…" disabled={!allOk || !matches} className="w-full">
            Save new password
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
