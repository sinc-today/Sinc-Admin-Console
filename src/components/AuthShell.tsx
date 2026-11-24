import Link from 'next/link';
import { SincLogo, SincMark } from './Brand';

/** Same frame as the sign-in page, for forgot / reset password. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <Link href="/login" aria-label="Sinc Admin" className="flex h-8 w-fit cursor-pointer items-center transition-opacity hover:opacity-80">
          <SincLogo className="h-8" />
        </Link>
        <div className="mx-auto w-full max-w-[400px] py-16">{children}</div>
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
        </div>
      </aside>
    </main>
  );
}
