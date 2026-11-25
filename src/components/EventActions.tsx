'use client';

import { DownloadSimple, Globe, LockSimple, Star, Ticket as TicketIcon } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api } from '@/lib/api';
import { fmt } from './analytics-ui';
import { Modal } from './Modal';
import { Button, Field, inputClass, Skeleton } from './ui';

/** A short confirm-with-reason dialog for one staff action. */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirm,
  placeholder,
  onConfirm,
  pending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirm: string;
  placeholder: string;
  onConfirm: (reason: string) => void;
  pending: boolean;
  error: unknown;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} width="max-w-[520px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason);
        }}
      >
        <Field label="Reason (audit log)" htmlFor="ea-reason">
          <input id="ea-reason" autoFocus required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} />
        </Field>
        {!!error && <p className="text-[12px] text-ember-ink">{(error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={reason.trim().length < 5}>
            {confirm}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Feature / unfeature the event in the app (events.manage). */
export function FeatureEventButton({ eventId, featured }: { eventId: number; featured: boolean }) {
  const can = useCan('events.manage');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: (reason: string) => api(`/events/${eventId}/featured`, { method: 'PATCH', json: { isFeatured: !featured, reason } }),
    meta: { success: featured ? 'Event no longer featured' : 'Event featured' },
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['event'] });
    },
  });
  if (!can) return null;
  return (
    <>
      <Button variant="secondary" icon={<Star size={16} weight={featured ? 'fill' : 'regular'} className={featured ? 'text-ember' : undefined} aria-hidden />} onClick={() => setOpen(true)}>
        {featured ? 'Unfeature' : 'Feature'}
      </Button>
      {open && (
        <ReasonDialog
          open
          onClose={() => setOpen(false)}
          title={featured ? 'Stop featuring this event?' : 'Feature this event?'}
          description={featured ? 'It leaves the featured list in the app. Nothing else changes.' : 'It appears in the featured list in the app. Private events are never shown there.'}
          confirm={featured ? 'Unfeature' : 'Feature'}
          placeholder={featured ? 'e.g. Campaign ended' : 'e.g. Paid promotion until Friday'}
          onConfirm={(r) => m.mutate(r)}
          pending={m.isPending}
          error={m.error}
        />
      )}
    </>
  );
}

/** Make the event private or public (events.manage). */
export function EventPrivacyButton({ eventId, privacy }: { eventId: number; privacy: string | null }) {
  const can = useCan('events.manage');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isPrivate = privacy === 'PRIVATE';
  const m = useMutation({
    mutationFn: (reason: string) => api(`/events/${eventId}/privacy`, { method: 'PATCH', json: { privacy: isPrivate ? 'PUBLIC' : 'PRIVATE', reason } }),
    meta: { success: isPrivate ? 'Event is now public' : 'Event is now private' },
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['event'] });
    },
  });
  if (!can) return null;
  return (
    <>
      <Button variant="secondary" icon={isPrivate ? <Globe size={16} aria-hidden /> : <LockSimple size={16} aria-hidden />} onClick={() => setOpen(true)}>
        {isPrivate ? 'Make public' : 'Make private'}
      </Button>
      {open && (
        <ReasonDialog
          open
          onClose={() => setOpen(false)}
          title={isPrivate ? 'Make this event public?' : 'Make this event private?'}
          description={
            isPrivate
              ? 'It shows in the feed and search again. Anyone can find it and buy tickets.'
              : 'It leaves the feed and search. People with the link and existing ticket holders keep access; tickets already sold stay valid.'
          }
          confirm={isPrivate ? 'Make public' : 'Make private'}
          placeholder={isPrivate ? 'e.g. Organizer asked to publish it' : 'e.g. Invite-only event'}
          onConfirm={(r) => m.mutate(r)}
          pending={m.isPending}
          error={m.error}
        />
      )}
    </>
  );
}

interface Options {
  ended: boolean;
  tickets: { id: number; name: string | null; price: number; left: number; disabled: boolean }[];
  templates: string[];
  eventTemplate: string | null;
}
interface Generated {
  files: { id: number; filename: string; sizeMB: number; url: string }[];
  expiresAt: string | null;
  ticketCount: number;
  emailedTo: string | null;
  emailError: string | null;
}
const designName = (t: string) => (t === 'default' ? 'Standard Sinc ticket' : t.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));

/** Generate complimentary tickets and download them as ZIP files (tickets.generate). */
export function GenerateTicketsButton({ eventId, eventName, currency }: { eventId: number; eventName: string; currency?: string | null }) {
  const can = useCan('tickets.generate');
  const [open, setOpen] = useState(false);
  if (!can) return null;
  return (
    <>
      <Button variant="secondary" icon={<TicketIcon size={16} aria-hidden />} onClick={() => setOpen(true)}>
        Generate tickets
      </Button>
      {open && <GenerateDialog eventId={eventId} eventName={eventName} currency={currency} onClose={() => setOpen(false)} />}
    </>
  );
}

function GenerateDialog({ eventId, eventName, currency, onClose }: { eventId: number; eventName: string; currency?: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const opts = useQuery({ queryKey: ['generate-options', eventId], queryFn: () => api<Options>(`/events/${eventId}/generate-options`) });
  const [f, setF] = useState({ ticketId: 0, quantity: 1, template: '', email: '', reason: '' });
  const [done, setDone] = useState<Generated | null>(null);
  const tickets = opts.data?.tickets ?? [];
  const chosen = tickets.find((t) => t.id === f.ticketId) ?? tickets.find((t) => !t.disabled && t.left > 0);
  const max = Math.min(100, chosen?.left ?? 0);
  const template = f.template || opts.data?.eventTemplate || 'default';
  const m = useMutation({
    mutationFn: () =>
      api<Generated>(`/events/${eventId}/generate-tickets`, {
        method: 'POST',
        json: { ticketId: chosen!.id, quantity: f.quantity, template, email: f.email, reason: f.reason },
      }),
    meta: { success: 'Tickets generated' },
    onSuccess: (r) => {
      setDone(r);
      qc.invalidateQueries({ queryKey: ['event'] });
      qc.invalidateQueries({ queryKey: ['generate-options', eventId] });
    },
  });
  return (
    <Modal open onClose={onClose} title="Generate tickets" description={`${eventName}. Complimentary tickets (paid amount 0) that count against the ticket type's capacity. They are emailed as a ZIP of PDF files, and you can download them here too.`} width="max-w-[600px]">
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-[16px] text-ink">
            {done.ticketCount} ticket{done.ticketCount === 1 ? '' : 's'} generated
          </p>
          {done.emailedTo ? (
            <p className="text-[14px] text-ink-secondary">
              Emailed to <span className="text-ink">{done.emailedTo}</span>, with a download link.
            </p>
          ) : (
            <p className="text-[13px] text-ember-ink">The email could not be sent{done.emailError ? `: ${done.emailError}` : ''}. Download the file below and send it yourself.</p>
          )}
          <ul className="flex flex-col gap-2">
            {done.files.map((d) => (
              <li key={d.id}>
                <a href={`/admin-api/v1${d.url}`} download={d.filename} className="flex items-center justify-between gap-3 border border-line-strong px-4 py-3 text-[14px] text-ink hover:bg-fog">
                  <span className="flex min-w-0 items-center gap-2">
                    <DownloadSimple size={18} aria-hidden />
                    <span className="truncate">Download {d.filename}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-muted">{d.sizeMB} MB</span>
                </a>
              </li>
            ))}
          </ul>
          {done.expiresAt && <p className="text-[12px] text-ink-muted">Links work until {new Date(done.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</p>}
          <div className="flex gap-2">
            <Button onClick={onClose}>Done</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null);
                setF({ ...f, reason: '', email: '' });
              }}
            >
              Generate more
            </Button>
          </div>
        </div>
      ) : opts.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : opts.error ? (
        <p className="text-[13px] text-ember-ink">{(opts.error as Error).message}</p>
      ) : opts.data?.ended ? (
        <p className="text-[14px] text-ink-secondary">This event has ended, so no new tickets can be generated.</p>
      ) : !tickets.length ? (
        <p className="text-[14px] text-ink-secondary">This event has no ticket types yet.</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-medium text-ink-secondary">Ticket type</legend>
            <div className="flex flex-col gap-1.5">
              {tickets.map((t) => {
                const off = t.disabled || t.left <= 0;
                return (
                  <label key={t.id} className={clsx('flex items-center justify-between gap-3 border px-3 py-2.5 text-[14px]', chosen?.id === t.id ? 'border-ink' : 'border-line-strong', off ? 'cursor-not-allowed text-ink-disabled' : 'cursor-pointer hover:bg-fog')}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="gt-ticket" disabled={off} checked={chosen?.id === t.id} onChange={() => setF({ ...f, ticketId: t.id, quantity: Math.min(f.quantity, Math.min(100, t.left)) || 1 })} />
                      {t.name ?? `Ticket #${t.id}`}
                      <span className="text-[12px] text-ink-muted">{t.price > 0 ? fmt('money', t.price, currency ?? undefined) : 'Free'}</span>
                    </span>
                    <span className="text-[12px] text-ink-muted">{t.disabled ? 'Disabled' : t.left > 0 ? `${fmt('count', t.left)} left` : 'Sold out'}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="How many" htmlFor="gt-qty" helper={`1 to ${max} at a time`}>
              <input id="gt-qty" type="number" min={1} max={max || 1} required className={inputClass} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Math.max(1, Math.min(max || 1, Number(e.target.value) || 1)) })} />
            </Field>
            <Field label="Ticket design" htmlFor="gt-design">
              <select id="gt-design" className={inputClass} value={template} onChange={(e) => setF({ ...f, template: e.target.value })}>
                {(opts.data?.templates ?? ['default']).map((t) => (
                  <option key={t} value={t}>
                    {designName(t)}
                    {t === opts.data?.eventTemplate ? ' (this event’s design)' : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Send the tickets to" htmlFor="gt-email" helper="We email this address a link to the ZIP (valid 7 days). It's also saved on the order so the tickets can be found and resent later.">
            <input id="gt-email" type="email" required autoComplete="email" className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" />
          </Field>
          <Field label="Reason (audit log)" htmlFor="gt-reason">
            <input id="gt-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Sponsor guest list" />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} loadingText="Generating… this can take a minute" disabled={!chosen || max < 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim()) || f.reason.trim().length < 5}>
              Generate {f.quantity} ticket{f.quantity === 1 ? '' : 's'}
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
