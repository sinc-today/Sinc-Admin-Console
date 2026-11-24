/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';

/**
 * The Sinc logo (public/brand). The wordmark has a light and a dark version; CSS in globals.css shows the one
 * that matches the theme. The mark (the orange sail) works on both.
 */
export function SincLogo({ className, admin = true }: { className?: string; admin?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <img src="/brand/sinc-logo.png" alt="Sinc" width={804} height={312} className="brand-light h-full w-auto" />
      <img src="/brand/sinc-logo-white.png" alt="Sinc" width={804} height={312} className="brand-dark h-full w-auto" />
      {admin && <span className="rounded-[4px] bg-fog px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-secondary">Admin</span>}
    </span>
  );
}

export function SincMark({ className, label = 'Sinc' }: { className?: string; label?: string }) {
  return <img src="/brand/sinc-mark.png" alt={label} width={245} height={312} className={clsx('w-auto', className)} />;
}
