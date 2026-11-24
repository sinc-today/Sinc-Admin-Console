'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button, Field, inputClass, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { SincLogo, SincMark } from '@/components/Brand';

type Step = 'password' | 'mfa_setup' | 'mfa_verify';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason');
  const next = params.get('next');
  const [step, setStep] = useState<Step>('password');
  const [name, setName] = useState('');

  const done = () => {
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    router.replace(safeNext);
    router.refresh();
  };

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <p className="flex h-8 items-center">
          <SincLogo className="h-8" />
        </p>
        <div className="mx-auto w-full max-w-[400px] py-16">
          {step === 'password' && (
            <PasswordStep
              reason={reason}
              onDone={(nextStep, displayName) => {
                setName(displayName);
                setStep(nextStep);
              }}
            />
          )}
          {step === 'mfa_setup' && <MfaSetupStep name={name} onDone={done} />}
          {step === 'mfa_verify' && <MfaVerifyStep name={name} onDone={done} onBack={() => setStep('password')} />}
        </div>
        <p className="text-[12px] text-ink-muted">Staff only. Every sign-in and action is recorded.</p>
      </section>
      <aside aria-hidden className="relative hidden overflow-hidden bg-ash lg:block" style={{ borderRadius: '6px 0 0 0' }}>
        <SincMark className="absolute right-16 top-16 h-28" label="" />
        <div className="absolute inset-x-16 bottom-16">
          <p className="display text-[66px] leading-[0.91] tracking-[-1.32px] text-ink">
            The day-to-day
            <br />
            of Sinc, in one place.
          </p>
          <p className="mt-6 max-w-[44ch] text-[18px] leading-[1.25] text-ink-secondary">
            Money, marketplace, growth and platform health for the team that runs it.
          </p>
        </div>
      </aside>
    </main>
  );
}

function PasswordStep({ reason, onDone }: { reason: string | null; onDone: (next: Step, name: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ next: 'mfa_setup' | 'mfa_verify'; displayName: string }>('/auth/login', {
        method: 'POST',
        json: { username, password },
      });
      onDone(res.next, res.displayName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Sign in</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">Use your Sinc account. Admin access and two-factor authentication are required.</p>
      {reason && (
        <div className="mt-6">
          <StatusBadge status="info">{reason}</StatusBadge>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-5">
        <Field label="Email or username" htmlFor="username">
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={error ?? undefined}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'password-error' : undefined}
            className={inputClass}
          />
        </Field>
        <Link href="/forgot-password" className="-mt-2 self-end text-[13px] text-ink-secondary underline underline-offset-4 hover:text-ink">
          Forgot password?
        </Link>
        <Button type="submit" loading={busy} disabled={!username || !password} className="w-full">
          Continue
        </Button>
      </div>
    </form>
  );
}

function CodeInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <input
      ref={ref}
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      aria-invalid={invalid}
      aria-describedby={invalid ? `${id}-error` : `${id}-help`}
      className={`${inputClass} display num h-12 text-center text-[32px] tracking-[0.3em]`}
    />
  );
}

function useVerify(onDone: () => void) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/mfa/verify', { method: 'POST', json: { code } });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };
  return { code, setCode, error, busy, verify };
}

function MfaSetupStep({ name, onDone }: { name: string; onDone: () => void }) {
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { code, setCode, error, busy, verify } = useVerify(onDone);

  useEffect(() => {
    api<{ qrDataUrl: string; secret: string }>('/auth/mfa/setup', { method: 'POST' })
      .then(setQr)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't start two-factor setup."));
  }, []);

  return (
    <form onSubmit={verify} noValidate>
      <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Set up two-factor</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">
        {name ? `Welcome, ${name}. ` : ''}Scan this code with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code it shows.
      </p>
      <div className="mt-8 flex items-start gap-6">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr.qrDataUrl} alt="QR code for your authenticator app" width={160} height={160} className="size-40 border border-line" />
        ) : (
          <span className="skeleton block size-40" role="status" aria-label="Loading QR code" />
        )}
        <div className="min-w-0 text-[12px] text-ink-muted">
          <p>Can&apos;t scan? Enter this key manually:</p>
          <p className="num mt-1 break-all text-[13px] text-ink">{qr?.secret.match(/.{1,4}/g)?.join(' ') ?? '••••'}</p>
        </div>
      </div>
      {loadError && <p className="mt-4 text-[12px] text-ember-ink">{loadError}</p>}
      <div className="mt-8 flex flex-col gap-5">
        <Field label="6-digit code" htmlFor="code" error={error ?? undefined} helper="The code changes every 30 seconds.">
          <CodeInput id="code" value={code} onChange={setCode} invalid={Boolean(error)} />
        </Field>
        <Button type="submit" loading={busy} disabled={code.length !== 6 || !qr} className="w-full">
          Turn on and sign in
        </Button>
      </div>
    </form>
  );
}

function MfaVerifyStep({ name, onDone, onBack }: { name: string; onDone: () => void; onBack: () => void }) {
  const { code, setCode, error, busy, verify } = useVerify(onDone);
  return (
    <form onSubmit={verify} noValidate>
      <h1 className="display text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">Enter your code</h1>
      <p className="mt-2 text-[14px] text-ink-secondary">{name ? `Signed in as ${name}. ` : ''}Open your authenticator app and enter the 6-digit code for Sinc Admin.</p>
      <div className="mt-8 flex flex-col gap-5">
        <Field label="6-digit code" htmlFor="code" error={error ?? undefined} helper="Lost your device? Ask an owner to reset your two-factor authentication.">
          <CodeInput id="code" value={code} onChange={setCode} invalid={Boolean(error)} />
        </Field>
        <Button type="submit" loading={busy} disabled={code.length !== 6} className="w-full">
          Sign in
        </Button>
        <Button type="button" variant="quiet" onClick={onBack} className="self-start">
          Use a different account
        </Button>
      </div>
    </form>
  );
}
