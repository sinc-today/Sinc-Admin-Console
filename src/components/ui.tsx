'use client';

import clsx from 'clsx';
import { CheckCircle, Clock, WarningCircle, XCircle, Info } from '@phosphor-icons/react/dist/ssr';
import { forwardRef, useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

/* ------------------------------------------------------------------ Button
 * Radius 0, PolySans/Inter Tight 16px, one line. Never orange-filled.
 */
type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'destructive';

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean; icon?: React.ReactNode; loadingText?: string }
>(function Button({ variant = 'primary', loading, icon, className, children, disabled, loadingText, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'display inline-flex h-10 min-w-10 items-center justify-center gap-2 whitespace-nowrap px-5 text-[16px] leading-none',
        'cursor-pointer transition-[background-color,color,transform,box-shadow,border-color] duration-150 ease-ledger active:translate-y-px active:scale-[0.99]',
        'disabled:cursor-not-allowed disabled:active:translate-y-0',
        variant === 'primary' && 'bg-ink text-canvas hover:bg-ink-secondary hover:shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)] disabled:bg-line-strong disabled:text-ink-muted disabled:shadow-none',
        variant === 'secondary' && 'border border-ink bg-transparent text-ink hover:bg-fog disabled:border-line-strong disabled:text-ink-disabled',
        variant === 'quiet' && 'px-2 text-ink hover:underline hover:decoration-ember hover:underline-offset-4 disabled:text-ink-disabled',
        variant === 'destructive' && 'bg-ink text-canvas hover:bg-ember-ink hover:shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)] disabled:bg-line-strong disabled:text-ink-muted disabled:shadow-none',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {loading ? (loadingText ?? progressive(children)) : children}
    </button>
  );
});

const IRREGULAR: Record<string, string> = { set: 'Setting', run: 'Running', stop: 'Stopping', add: 'Adding', put: 'Putting', get: 'Getting', sign: 'Signing', log: 'Logging' };

/** "Send tickets" → "Sending…", "Save" → "Saving…". Non-text labels are left as they are. */
export function progressive(label: React.ReactNode): React.ReactNode {
  if (typeof label !== 'string') return label;
  const first = label.trim().split(/\s+/)[0];
  if (!first || !/^[A-Za-z]+$/.test(first)) return label;
  const w = first.toLowerCase();
  const ing = IRREGULAR[w] ?? (w.endsWith('ie') ? `${w.slice(0, -2)}ying` : w.endsWith('e') && !w.endsWith('ee') ? `${w.slice(0, -1)}ing` : `${w}ing`);
  return `${ing.charAt(0).toUpperCase()}${ing.slice(1)}…`;
}

export const Spinner = () => (
  <span aria-hidden className="inline-block size-4 border-2 border-current border-r-transparent motion-safe:animate-spin" style={{ borderRadius: 999 }} />
);

/* ------------------------------------------------------------------ Tag */
export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'brass' }) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center rounded-tag px-2.5 text-[12px] font-medium leading-none',
        tone === 'neutral' ? 'bg-fog text-ink' : 'bg-fog text-brass'
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Status
 * Always icon + text; colour supplementary (prompt 8.3).
 */
export type Status = 'ok' | 'warning' | 'critical' | 'pending' | 'info';

const STATUS_STYLE: Record<Status, { cls: string; Icon: typeof CheckCircle }> = {
  ok: { cls: 'text-ink', Icon: CheckCircle },
  warning: { cls: 'bg-brass-wash text-brass-ink', Icon: WarningCircle },
  critical: { cls: 'bg-ember-wash text-ember-ink', Icon: XCircle },
  pending: { cls: 'text-ink-muted', Icon: Clock },
  info: { cls: 'text-ink-secondary', Icon: Info },
};

export function StatusBadge({ status, children }: { status: Status; children: React.ReactNode }) {
  const { cls, Icon } = STATUS_STYLE[status];
  return (
    <span className={clsx('inline-flex h-6 items-center gap-1.5 rounded-tag px-2 text-[12px] font-medium leading-none', cls)}>
      <Icon size={14} weight="regular" aria-hidden />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Delta
 * Bad direction in ember-ink, good/neutral in ink. Arrow always present.
 */
export function Delta({ value, polarity }: { value: number; polarity: 'up_is_good' | 'up_is_bad' | 'neutral' }) {
  const up = value >= 0;
  const bad = (polarity === 'up_is_good' && !up) || (polarity === 'up_is_bad' && up);
  return (
    <span className={clsx('num text-[12px] font-medium', bad ? 'text-ember-ink' : 'text-ink')}>
      <span aria-hidden>{up ? '▲' : '▼'}</span> {Math.abs(value * 100).toFixed(1)}%
      <span className="sr-only">{up ? ' increase' : ' decrease'}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ InfoTip
 * An "i" button next to a label. Opens on hover, keyboard focus or click; Esc closes.
 * Holds explanations (formulas, data sources, setup), never the only copy of a money warning.
 */
export function InfoTip({ children, label = 'More information', className }: { children: React.ReactNode; label?: string; className?: string }) {
  // Hover (or focus) previews the tip; a click or tap pins it open until you click again, click away or press Escape.
  // Radix would toggle on click, which closed the tip the hover had just opened, so the click is handled here.
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    if (pinned.current) return;
    timer.current = setTimeout(() => setOpen(false), 120);
  };
  const close = () => {
    pinned.current = false;
    setOpen(false);
  };
  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? show() : close())}>
      <Popover.Trigger
        ref={trigger}
        type="button"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault(); // skip Radix's toggle
          e.stopPropagation(); // don't trigger a clickable row or card around the icon
          if (pinned.current) close();
          else {
            pinned.current = true;
            show();
          }
        }}
        className={clsx('inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-pill align-middle text-ink-muted transition-colors hover:bg-fog hover:text-ink', open && 'text-ink', className)}
      >
        <Info size={14} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onMouseEnter={show}
          onMouseLeave={hide}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={close}
          onPointerDownOutside={(e) => {
            // A press on the icon itself is handled by its click (pin / unpin), not as "outside".
            if (trigger.current?.contains(e.target as Node)) e.preventDefault();
            else close();
          }}
          className="z-[60] max-w-[300px] border border-line-strong bg-canvas px-3 py-2 text-[12px] leading-[1.45] text-ink-secondary shadow-sm"
          style={{ borderRadius: 0 }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A label with an optional InfoTip after it. */
export function Term({ children, tip }: { children: React.ReactNode; tip?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {tip && <InfoTip label={`About ${typeof children === 'string' ? children : 'this'}`}>{tip}</InfoTip>}
    </span>
  );
}

/* ------------------------------------------------------------------ Freshness chip */
export function FreshnessChip({ label }: { label: string }) {
  const delayed = /^Delayed|^Waiting/.test(label);
  const text = label.replace(/^Delayed\.\s*/, '').replace(/^Updated /, '');
  return (
    <span
      aria-live="polite"
      className={clsx('inline-flex h-6 items-center gap-1 rounded-tag px-2 text-[11px] font-medium', delayed ? 'bg-brass-wash text-brass-ink' : 'bg-fog text-ink-muted')}
      title={label}
    >
      {delayed ? <WarningCircle size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
      {delayed ? `Delayed · ${text}` : text}
    </span>
  );
}

/** Thin bar shown while data refreshes in the background. */
export function ProgressBar({ active, className }: { active: boolean; className?: string }) {
  if (!active) return null;
  return (
    <span role="progressbar" aria-label="Refreshing" className={clsx('pointer-events-none absolute inset-x-0 top-0 block h-0.5 overflow-hidden', className)}>
      <span className="progress-run block h-full w-1/3 bg-ember" />
    </span>
  );
}

/* ------------------------------------------------------------------ Panels
 * `info` goes in an InfoTip next to the title. `note` stays visible: only for money or irreversible consequences.
 * `freshness` accepts the old free text: "Updated …" becomes a chip, a few words show as a muted caption,
 * anything longer moves into the InfoTip.
 */
const isFreshness = (t: string) => /^(Delayed\.|Updated |Waiting for the first)/.test(t);
const isShort = (t: string) => t.split(/\s+/).length <= 6 && !/[.;:]\s/.test(t);

export function Panel({
  title,
  actions,
  freshness,
  info,
  note,
  busy,
  children,
  className,
}: {
  title?: string;
  actions?: React.ReactNode;
  freshness?: string;
  info?: React.ReactNode;
  note?: React.ReactNode;
  busy?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const chip = freshness && isFreshness(freshness) ? freshness : undefined;
  const caption = freshness && !chip && isShort(freshness) ? freshness.replace(/\.$/, '') : undefined;
  const tip = info ?? (freshness && !chip && !caption ? freshness : undefined);
  return (
    <section className={clsx('relative rounded-panel bg-canvas p-6', className)} aria-label={title} aria-busy={busy || undefined}>
      <ProgressBar active={!!busy} className="rounded-t-panel" />
      {(title || actions || chip) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {title && <h2 className="display truncate text-[16px] leading-tight text-ink">{title}</h2>}
            {tip && <InfoTip label={title ? `About ${title}` : 'About this section'}>{tip}</InfoTip>}
            {caption && <span className="ml-1 truncate text-[12px] text-ink-muted">{caption}</span>}
          </div>
          {(actions || chip) && (
            <div className="flex items-center gap-2">
              {chip && <FreshnessChip label={chip} />}
              {actions}
            </div>
          )}
        </header>
      )}
      {note && <p className="-mt-2 mb-4 text-[12px] text-ink-secondary">{note}</p>}
      {children}
    </section>
  );
}

/** One-line empty message inside a panel. */
export function InlineEmpty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-3 py-2 text-[13px] text-ink-muted">
      <span>{children}</span>
      {action}
    </p>
  );
}

/** "Still loading…" once a request has taken longer than 8 seconds. */
export function useSlow(active: boolean, ms = 8000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return slow;
}

export function SlowNote({ active }: { active: boolean }) {
  const slow = useSlow(active);
  return slow ? <p className="text-[12px] text-ink-muted" aria-live="polite">Still loading…</p> : null;
}

export function FeaturePanel({ children, tone = 'ash', className }: { children: React.ReactNode; tone?: 'ash' | 'ivory' | 'canvas'; className?: string }) {
  return (
    <section
      className={clsx(
        'rounded-feature p-6',
        tone === 'ash' && 'bg-ash',
        tone === 'ivory' && 'bg-ivory',
        tone === 'canvas' && 'bg-canvas',
        className
      )}
    >
      {children}
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('skeleton block', className)} />;
}

/* ------------------------------------------------------------------ KPI tile */
export function KpiTile({
  label,
  definition,
  value,
  compare,
  loading,
  empty,
}: {
  label: string;
  definition: string;
  value?: string;
  compare?: React.ReactNode;
  loading?: boolean;
  empty?: string;
}) {
  return (
    <div className="flex min-h-[148px] flex-col rounded-panel bg-canvas p-5">
      <p className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
        {label}
        <InfoTip label={`About ${label}`}>{definition}</InfoTip>
      </p>
      {loading ? (
        <div className="mt-3 space-y-3" role="status" aria-label={`Loading ${label}`}>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-full" />
        </div>
      ) : empty ? (
        <p className="mt-3 text-[13px] text-ink-muted">{empty}</p>
      ) : (
        <>
          <p className="display num mt-2 text-[32px] leading-[1.19] text-ink">{value}</p>
          {compare && <div className="mt-1">{compare}</div>}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ States */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel bg-fog px-5 py-4">
      <div className="min-w-0">
        <p className="text-[14px] text-ink">{title}</p>
        {body && <p className="mt-0.5 text-[12px] text-ink-muted">{body}</p>}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/** Friendly one-line error with Retry. Raw server text only appears in the tooltip. */
export function ErrorState({ message, requestId, onRetry, what }: { message?: string; requestId?: string; onRetry?: () => void; what?: string }) {
  const friendly = friendlyError(message);
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 py-2">
      <StatusBadge status="critical">{what ? `Couldn't load ${what}` : "Couldn't load"}</StatusBadge>
      <span className="text-[13px] text-ink-secondary" title={[message, requestId && `Request ${requestId}`].filter(Boolean).join(' · ')}>
        {friendly}
      </span>
      {onRetry && (
        <Button variant="secondary" className="h-8 px-3 text-[14px]" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Turns server or network errors into one plain sentence. */
export function friendlyError(message?: string) {
  if (!message) return 'Something went wrong.';
  if (/fetch|network|ECONN|ENOTFOUND|timeout|Failed to/i.test(message)) return 'The server did not answer. Check your connection.';
  if (/permission|forbidden|not allowed/i.test(message)) return "Your role can't see this.";
  if (/sign in|unauthori[sz]ed|session/i.test(message)) return 'Your session ended. Sign in again.';
  if (message.length > 90 || /\bat \w+ \(|Error:|SQL|relation|column/.test(message)) return 'Something went wrong on the server.';
  return message;
}

/* ------------------------------------------------------------------ Form fields */
export function Field({
  label,
  htmlFor,
  helper,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-[12px] text-ember-ink">
          <WarningCircle size={14} aria-hidden /> {error}
        </p>
      ) : helper ? (
        <p id={`${htmlFor}-help`} className="text-[12px] text-ink-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'h-10 w-full border border-line-strong bg-canvas px-3 text-[14px] text-ink placeholder:text-ink-muted disabled:bg-fog disabled:text-ink-disabled aria-[invalid=true]:border-ember-ink';
