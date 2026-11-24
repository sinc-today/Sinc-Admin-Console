'use client';

import { CheckCircle, EnvelopeSimple, MagnifyingGlass, PaperPlaneTilt, Ticket as TicketIcon, X } from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api, ApiError } from '@/lib/api';
import { useInMarket } from '@/lib/market';
import { Modal } from './Modal';
import { Button, Field, inputClass, Spinner } from './ui';

interface Result {
  tickets: number;
  email: { to: string; queued: boolean } | null;
  sms: { to: string; sent: boolean } | null;
}

/** One purchase or sign-up for an event (GET /events/:id/sincups). Contacts come masked. */
export interface Sincup {
  id: number;
  createdAt: string;
  name: string | null;
  customerId: number | null;
  userId: number | null;
  email: string | null;
  phone: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
  ticket: string | null;
  quantity: number;
  tickets: number;
  scanned: number;
  paidAmount: number;
  currency: string | null;
  method: string;
  discountApplied: boolean;
}

const REASONS = ['Lost the SMS', "Didn't get the email", 'Changed phone', 'Deleted the tickets', 'Asked at the gate'];
const dt = (s: string) => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Who to resend to: a known purchase, a Sinc user, a looked-up customer, or found in the dialog. */
type Target = { sincup?: Sincup; userId?: number; customerId?: number };

/**
 * "Resend tickets" for one customer and one event. Codes never change; the same PDFs and SMS go out again.
 * Pass `sincup` (attendee list row), `userId` (user page) or `customerId` (partner customer lookup); otherwise the
 * dialog searches the event's sign-ups as you type.
 */
export function ResendTicketsButton({
  eventId,
  eventName,
  userId,
  customerId,
  sincup,
  variant = 'secondary',
  label = 'Resend tickets',
  compact = false,
}: {
  eventId: number;
  eventName: string;
  userId?: number;
  customerId?: number;
  sincup?: Sincup;
  variant?: 'secondary' | 'quiet';
  label?: string;
  /** Icon-and-word button for table rows. */
  compact?: boolean;
}) {
  const can = useCan('tickets.resend');
  const [open, setOpen] = useState(false);
  if (!can) return null;
  const who = sincup?.name ? ` to ${sincup.name}` : '';
  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Resend tickets${who} for ${eventName}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[13px] text-ink ring-1 ring-line-strong hover:bg-ink hover:text-canvas hover:ring-ink"
        >
          <PaperPlaneTilt size={14} aria-hidden /> Resend
        </button>
      ) : (
        <Button variant={variant} icon={<PaperPlaneTilt size={16} aria-hidden />} onClick={() => setOpen(true)} aria-label={`${label} for ${eventName}`}>
          {label}
        </Button>
      )}
      {open && <ResendDialog eventId={eventId} eventName={eventName} initial={{ sincup, userId, customerId }} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Suggestions from the event's sign-ups while typing (name, email, phone digits or ticket code). */
function useSuggestions(eventId: number, q: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const inMarket = useInMarket();
  const canList = useCan(inMarket ? 'market.customers.read' : 'analytics.read');
  const query = useQuery({
    queryKey: ['sincups-suggest', eventId, debounced],
    queryFn: () => api<{ items: Sincup[] }>(`/events/${eventId}/sincups?q=${encodeURIComponent(debounced)}&limit=6`),
    enabled: enabled && canList && debounced.length >= 2,
    staleTime: 30_000,
  });
  return { items: query.data?.items ?? [], loading: query.isFetching, ready: debounced.length >= 2 && debounced === q.trim(), canList, error: query.error as ApiError | null };
}

/** What a typed value means when no suggestion is picked. */
const guessKind = (v: string): 'email' | 'phone' | 'codes' => {
  if (/@/.test(v)) return 'email';
  // Phone numbers are typed with spaces, + or dashes; ticket codes are single words or a list.
  if (/^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, '').length >= 9) return 'phone';
  return 'codes';
};

function SincupCard({ s, onChange }: { s: Sincup; onChange?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border border-line-strong bg-fog/50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] text-ink">{s.name ?? 'Customer without a name'}</p>
        <p className="mt-0.5 truncate text-[12px] text-ink-secondary">{[s.phone, s.email].filter(Boolean).join(' · ') || 'No phone or email on the order'}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <TicketIcon size={13} aria-hidden /> {s.tickets} × {s.ticket ?? 'ticket'}
          </span>
          <span>{s.method}</span>
          <span>{dt(s.createdAt)}</span>
          {s.scanned > 0 && <span>{s.scanned} checked in</span>}
        </p>
      </div>
      {onChange && (
        <button type="button" onClick={onChange} className="shrink-0 text-[13px] text-ink-secondary underline-offset-4 hover:text-ink hover:underline">
          Change
        </button>
      )}
    </div>
  );
}

export function ResendDialog({ eventId, eventName, initial, onClose }: { eventId: number; eventName: string; initial: Target; onClose: () => void }) {
  const fixed = !!(initial.userId || initial.customerId);
  const [picked, setPicked] = useState<Sincup | null>(initial.sincup ?? null);
  const [find, setFind] = useState('');
  const [active, setActive] = useState(0);
  const [f, setF] = useState({ email: true, sms: true, otherEmail: '', otherPhone: '', reason: '' });
  const [done, setDone] = useState<Result | null>(null);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const searching = !fixed && !picked;
  const sug = useSuggestions(eventId, find, searching);
  const typed = find.trim();
  const kind = guessKind(typed);
  // Options: suggestions, then "use exactly what I typed" when it looks like a phone, email or code.
  const options: ({ type: 'sincup'; s: Sincup } | { type: 'typed' })[] = [...sug.items.map((s) => ({ type: 'sincup' as const, s })), ...(typed.length >= 3 && (!sug.canList || (sug.ready && !sug.loading)) ? [{ type: 'typed' as const }] : [])];
  useEffect(() => setActive(0), [find, sug.items.length]);

  const pick = (s: Sincup) => {
    setPicked(s);
    setF((x) => ({ ...x, email: s.hasEmail || !!x.otherEmail, sms: s.hasPhone || !!x.otherPhone }));
  };
  const [useTyped, setUseTyped] = useState(false);
  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    if (o.type === 'sincup') pick(o.s);
    else setUseTyped(true);
  };

  const m = useMutation({
    meta: { success: 'Tickets resent' },
    mutationFn: () => {
      const channels = [sendEmail && 'email', sendSms && 'sms'].filter(Boolean);
      const deliverTo = f.otherEmail || f.otherPhone ? { email: f.otherEmail || undefined, phoneNumber: f.otherPhone || undefined } : undefined;
      const who = picked
        ? { sincupId: picked.id }
        : initial.customerId
          ? { customerId: initial.customerId }
          : initial.userId
            ? { userId: initial.userId }
            : kind === 'email'
              ? { email: typed }
              : kind === 'phone'
                ? { phoneNumber: typed }
                : { voucherCodes: typed.split(/[\s,]+/).filter(Boolean) };
      return api<Result>(`/events/${eventId}/resend-tickets`, { method: 'POST', json: { ...who, channels, deliverTo, reason: f.reason } });
    },
    onSuccess: setDone,
  });
  const ready = fixed || !!picked || (useTyped && typed.length >= 3);
  const noEmail = picked && !picked.hasEmail && !f.otherEmail;
  const noPhone = picked && !picked.hasPhone && !f.otherPhone;
  const sendEmail = f.email && !noEmail;
  const sendSms = f.sms && !noPhone;
  const line = (r: Result) =>
    [
      r.email ? (r.email.queued ? `email to ${r.email.to}` : 'no email (none on the order)') : null,
      r.sms ? (r.sms.sent ? `SMS to ${r.sms.to}` : 'SMS not sent (no phone on the order, or the gateway refused it)') : null,
    ]
      .filter(Boolean)
      .join(' and ');
  const reset = () => {
    setDone(null);
    setPicked(null);
    setUseTyped(false);
    setFind('');
    setF({ email: true, sms: true, otherEmail: '', otherPhone: '', reason: '' });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <Modal open onClose={onClose} title="Resend tickets" description={`${eventName}. Same ticket codes, sent again. Nothing new is issued.`} width="max-w-[600px]">
      {done ? (
        <div className="flex flex-col gap-5">
          <div role="status" className="flex items-start gap-3">
            <CheckCircle size={28} weight="fill" className="shrink-0 text-ink" aria-hidden />
            <div>
              <p className="text-[16px] text-ink">
                {(() => {
                  const n = done.tickets ?? picked?.tickets;
                  return n ? `Sent ${n} ticket${n === 1 ? '' : 's'}` : 'Tickets sent';
                })()}
                {picked?.name ? ` to ${picked.name}` : ''}
              </p>
              {line(done) && <p className="mt-1 text-[13px] text-ink-secondary">{line(done)}.</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Done</Button>
            {!fixed && !initial.sincup && (
              <Button variant="secondary" onClick={reset}>
                Resend for someone else
              </Button>
            )}
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) m.mutate();
          }}
        >
          {picked && <SincupCard s={picked} onChange={initial.sincup ? undefined : () => { setPicked(null); setTimeout(() => inputRef.current?.focus(), 0); }} />}

          {searching && !useTyped && (
            <div className="relative">
              <label htmlFor="rt-find" className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                Find the customer
              </label>
              <div className="relative">
                <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={inputRef}
                  id="rt-find"
                  autoFocus
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={options.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
                  className={clsx(inputClass, 'pl-9 pr-9')}
                  value={find}
                  onChange={(e) => setFind(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((a) => Math.min(a + 1, options.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((a) => Math.max(a - 1, 0));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      choose(active);
                    }
                  }}
                  placeholder="Name, phone, email or ticket code"
                />
                {sug.loading && (<span className="absolute right-3 top-1/2 -translate-y-1/2"><Spinner /></span>)}
              </div>
              <p className="mt-1 text-[12px] text-ink-muted">Start typing; matching customers of this event appear below.</p>
              {options.length > 0 && (
                <ul id={listId} role="listbox" aria-label="Matching customers" className="mt-2 max-h-[300px] overflow-y-auto border border-line-strong bg-canvas">
                  {options.map((o, i) => (
                    <li
                      key={o.type === 'sincup' ? o.s.id : 'typed'}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(i)}
                      className={clsx('cursor-pointer border-b border-line px-4 py-2.5 last:border-b-0', i === active && 'bg-fog')}
                    >
                      {o.type === 'sincup' ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[14px] text-ink">{o.s.name ?? 'No name'}</p>
                            <p className="truncate text-[12px] text-ink-secondary">{[o.s.phone, o.s.email].filter(Boolean).join(' · ') || 'No contact on the order'}</p>
                          </div>
                          <p className="shrink-0 text-right text-[12px] text-ink-muted">
                            {o.s.tickets} × {o.s.ticket ?? 'ticket'}
                            <br />
                            {dt(o.s.createdAt)}
                          </p>
                        </div>
                      ) : (
                        <p className="flex items-center gap-2 text-[13px] text-ink-secondary">
                          <EnvelopeSimple size={14} aria-hidden />
                          {sug.items.length ? 'Not listed? ' : sug.ready && !sug.loading ? 'No match in this event’s sign-ups. ' : ''}
                          Find tickets by this {kind === 'email' ? 'email' : kind === 'phone' ? 'phone number' : 'ticket code'}: <span className="text-ink">{typed}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {sug.error && <p className="mt-2 text-[12px] text-ember-ink">{sug.error.message}</p>}
            </div>
          )}

          {useTyped && !picked && (
            <div className="flex items-center justify-between gap-3 border border-line-strong px-4 py-3 text-[13px]">
              <span className="min-w-0 truncate">
                Tickets with this {kind === 'email' ? 'email' : kind === 'phone' ? 'phone number' : kind === 'codes' && typed.includes(' ') ? 'set of codes' : 'code'}: <span className="text-ink">{typed}</span>
              </span>
              <button type="button" onClick={() => setUseTyped(false)} className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink" aria-label="Search again">
                <X size={14} aria-hidden /> Change
              </button>
            </div>
          )}

          {ready && (
            <>
              <fieldset className="flex flex-col gap-2 text-[14px]">
                <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Send by</legend>
                <label className={clsx('flex items-center gap-2', noEmail && 'text-ink-disabled')}>
                  <input type="checkbox" checked={f.email && !noEmail} disabled={!!noEmail} onChange={(e) => setF({ ...f, email: e.target.checked })} />
                  Email with the PDF tickets {picked?.email && <span className="text-[12px] text-ink-muted">to {picked.email}</span>}
                  {noEmail && <span className="text-[12px]">(no email on the order)</span>}
                </label>
                <label className={clsx('flex items-center gap-2', noPhone && 'text-ink-disabled')}>
                  <input type="checkbox" checked={f.sms && !noPhone} disabled={!!noPhone} onChange={(e) => setF({ ...f, sms: e.target.checked })} />
                  SMS with codes and scan links {picked?.phone && <span className="text-[12px] text-ink-muted">to {picked.phone}</span>}
                  {noPhone && <span className="text-[12px]">(no phone on the order)</span>}
                </label>
              </fieldset>
              <details className="text-[13px]" open={!!(f.otherEmail || f.otherPhone)}>
                <summary className="cursor-pointer text-ink-secondary hover:text-ink">Send to a different email or phone</summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Other email" htmlFor="rt-oe">
                    <input id="rt-oe" type="email" className={inputClass} value={f.otherEmail} onChange={(e) => setF({ ...f, otherEmail: e.target.value, email: e.target.value ? true : f.email })} />
                  </Field>
                  <Field label="Other phone" htmlFor="rt-op">
                    <input id="rt-op" className={inputClass} value={f.otherPhone} onChange={(e) => setF({ ...f, otherPhone: e.target.value, sms: e.target.value ? true : f.sms })} placeholder="07… or +256…" />
                  </Field>
                </div>
                <p className="mt-2 text-[12px] text-ink-muted">Only when the customer asks, e.g. a new number. Recorded in the audit log.</p>
              </details>
              <div>
                <Field label="Reason (audit log)" htmlFor="rt-reason">
                  <input id="rt-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Why are you resending?" />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setF({ ...f, reason: r })}
                      className={clsx('h-7 rounded-pill px-3 text-[12px] ring-1', f.reason === r ? 'bg-ink text-canvas ring-ink' : 'text-ink-secondary ring-line-strong hover:bg-fog hover:text-ink')}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} loadingText="Sending…" disabled={!ready || (!sendEmail && !sendSms) || f.reason.trim().length < 5}>
              Resend{picked ? ` ${picked.tickets} ticket${picked.tickets === 1 ? '' : 's'}` : ''}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
