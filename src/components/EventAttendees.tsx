'use client';

import { useMemo, useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { useInMarket } from '@/lib/market';
import { fmt } from './analytics-ui';
import { SearchForm, Table, td, tdFirst, tdLast } from './directory-ui';
import { PagerBar, useCursorPager } from './pager';
import { ResendTicketsButton, type Sincup } from './ResendTickets';
import { ErrorState, InlineEmpty, Panel, Skeleton, StatusBadge } from './ui';
import { ApiError } from '@/lib/api';

const when = (s: string) => {
  const d = new Date(s);
  return {
    day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  };
};

/**
 * Everyone who bought or signed up for the event, newest first: customer (contacts masked), ticket, amount,
 * how they paid, check-ins, and a Resend button per purchase. Search by name, phone, email or ticket code.
 */
export function EventAttendees({ eventId, eventName, totals }: { eventId: number; eventName: string; totals?: { sold: number; scanned: number } }) {
  const inMarket = useInMarket();
  const can = useCan(inMarket ? 'market.customers.read' : 'analytics.read');
  const [q, setQ] = useState<string | null>(null);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    return p;
  }, [q]);
  const pager = useCursorPager<Sincup>(`/events/${eventId}/sincups`, params, { urlSize: false, initialSize: 25, enabled: can });
  if (!can) return null;
  return (
    <Panel
      title="Sign-ups"
      freshness={totals ? `${fmt('count', totals.sold)} tickets · ${fmt('count', totals.scanned)} checked in` : undefined}
      info="Every purchase and free sign-up for this event, newest first. Contacts are masked. Resend sends the same ticket codes again by email and SMS."
      busy={pager.isFetching && !pager.isLoading}
    >
      <div className="mb-4">
        <SearchForm id={`att-q-${eventId}`} label="Search sign-ups" placeholder="Name, phone, email or ticket code" helper="Part of a name, the start of an email, 4+ digits of a phone, or a full ticket code." initial="" onSearch={setQ} />
      </div>
      {pager.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : pager.error ? (
        <ErrorState what="sign-ups" message={(pager.error as Error).message} requestId={(pager.error as ApiError).requestId} onRetry={() => pager.refetch()} />
      ) : !pager.items.length ? (
        <InlineEmpty>{q ? `No sign-ups match “${q}”.` : 'No sign-ups yet.'}</InlineEmpty>
      ) : (
        <>
          <Table minWidth={860} head={['When', 'Customer', 'Ticket', { label: 'Paid', align: 'right' }, 'How', 'Checked in', '']}>
            {pager.items.map((s) => {
              const w = when(s.createdAt);
              return (
                <tr key={s.id} className="h-14 border-b border-line">
                  <td className={`${tdFirst} whitespace-nowrap`}>
                    <span className="text-ink">{w.day}</span>
                    <span className="block text-[12px] text-ink-muted">{w.time}</span>
                  </td>
                  <td className={`${td} max-w-[260px]`}>
                    <span className="block truncate text-ink">{s.name ?? 'No name'}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{[s.phone, s.email].filter(Boolean).join(' · ') || 'No contact on the order'}</span>
                  </td>
                  <td className={`${td} max-w-[200px]`}>
                    <span className="block truncate text-ink">{s.ticket ?? 'Ticket'}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {s.tickets} ticket{s.tickets === 1 ? '' : 's'}
                      {s.discountApplied ? ' · coupon' : ''}
                    </span>
                  </td>
                  <td className={`${td} num text-right`}>{s.paidAmount > 0 ? fmt('money', s.paidAmount, s.currency ?? undefined) : <span className="text-ink-muted">Free</span>}</td>
                  <td className={`${td} text-ink-secondary`}>{s.method}</td>
                  <td className={td}>
                    {s.tickets > 0 && s.scanned >= s.tickets ? (
                      <StatusBadge status="ok">All in</StatusBadge>
                    ) : s.scanned > 0 ? (
                      <StatusBadge status="pending">
                        {s.scanned} of {s.tickets}
                      </StatusBadge>
                    ) : (
                      <span className="text-[12px] text-ink-muted">Not yet</span>
                    )}
                  </td>
                  <td className={`${tdLast} text-right`}>
                    <ResendTicketsButton eventId={eventId} eventName={eventName} sincup={s} compact />
                  </td>
                </tr>
              );
            })}
          </Table>
          <PagerBar pager={pager} noun="sign-ups" sizes={[25, 50, 100]} />
        </>
      )}
    </Panel>
  );
}
