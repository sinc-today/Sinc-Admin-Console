'use client';

import { ArrowSquareOut, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLink } from '@/components/AppLink';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useCan } from '@/app/(console)/me-context';
import { fmt } from '@/components/analytics-ui';
import { Facts, RowLink, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { ErrorState, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Flyer } from './Flyer';
import { SidePane } from './SidePane';

interface EventDetail {
  event: {
    id: number;
    name: string;
    flyer: string | null;
    organizerProfileId: number | null;
    organizer: string | null;
    category: string | null;
    startDate: string;
    endDate: string;
    currency: string | null;
    privacy: string | null;
    locationName: string | null;
    feePayer?: 'ORGANIZER' | 'BUYER';
    tz: string;
  };
  totals: { sold: number; capacity: number; sellThrough: number | null; scanned: number; checkInRate: number | null };
  tickets: { id: number; name: string | null; price: number; sold: number; scanned: number; capacity: number }[];
  money: { currency: string; gmv: number; payments: number; failed: number }[];
  rank: { position: number; of: number; processed: number; currency: string | null } | null;
}

/** Opens over any console page when the URL has `?event=<id>`. */
export function EventPane() {
  const can = useCan('analytics.read');
  const [eventId, setEventId] = useQueryState('event', parseAsInteger);
  return (
    <SidePane open={!!eventId && can} onClose={() => setEventId(null)} label="Event details">
      <Body id={eventId!} onClose={() => setEventId(null)} />
    </SidePane>
  );
}

function Body({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['event', String(id)], queryFn: () => api<EventDetail>(`/events/${id}`) });
  const d = q.data;
  const e = d?.event;
  const now = Date.now();
  const status = !e ? null : new Date(e.startDate).getTime() > now ? (['info', 'Upcoming'] as const) : new Date(e.endDate).getTime() >= now ? (['ok', 'Live now'] as const) : (['pending', 'Ended'] as const);
  const cur = e?.currency ?? 'RWF';
  const gmv = d?.money.find((m) => m.currency === cur) ?? d?.money[0];
  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-ink-secondary">Event #{id}</p>
        <div className="flex shrink-0 items-center gap-2">
          <AppLink href={`/events/${id}`} onClick={onClose} className="inline-flex h-9 items-center gap-1.5 bg-canvas px-3 text-[13px] font-medium outline outline-1 outline-line-strong hover:bg-fog">
            Full page <ArrowSquareOut size={14} aria-hidden />
          </AppLink>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-9 items-center justify-center bg-canvas outline outline-1 outline-line-strong hover:bg-fog" autoFocus>
            <X size={16} aria-hidden />
          </button>
        </div>
      </header>
      {q.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : (
        d &&
        e && (
          <>
            <Flyer src={e.flyer} name={e.name} className="aspect-[4/5] max-h-[360px] w-full object-contain" hideIfMissing />
            <div>
              <h2 className="display break-words text-[22px] leading-tight text-ink sm:text-[28px]">{e.name}</h2>
              <p className="mt-1 text-[13px] text-ink-secondary">
                {formatDateTime(e.startDate, e.tz)}
                {e.locationName && ` · ${e.locationName}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {status && <StatusBadge status={status[0]}>{status[1]}</StatusBadge>}
                {e.category && <Tag>{e.category}</Tag>}
                {e.privacy === 'PRIVATE' && <Tag>Private</Tag>}
                {e.feePayer === 'BUYER' && <Tag>Buyer pays fee</Tag>}
              </div>
              {e.organizerProfileId && (
                <p className="mt-2 text-[13px] text-ink-secondary">
                  By <RowLink href={`/organizers/${e.organizerProfileId}`}>{e.organizer ?? `Organizer #${e.organizerProfileId}`}</RowLink>
                </p>
              )}
            </div>
            <section className="bg-canvas p-4" aria-label="Key figures">
              <Facts
                cols={2}
                items={[
                  { label: 'Rank by amount processed', value: d.rank && d.rank.processed > 0 ? `#${fmt('count', d.rank.position)} of ${fmt('count', d.rank.of)}` : 'Not ranked yet', hint: `Among all ${cur} events, lifetime` },
                  { label: 'Amount processed', value: d.rank ? fmt('money', d.rank.processed, cur) : 'No data', hint: 'Paid for tickets and sign-ups' },
                  { label: 'Tickets issued', value: `${fmt('count', d.totals.sold)} of ${fmt('count', d.totals.capacity)}` },
                  { label: 'Attendance', value: `${fmt('count', d.totals.scanned)} (${fmt('ratio', d.totals.checkInRate)})`, hint: 'Tickets checked in at the door' },
                  { label: 'Provider payments', value: gmv ? `${fmt('count', gmv.payments)} · ${fmt('money', gmv.gmv, gmv.currency, true)}` : 'None' },
                  { label: 'Failed payments', value: gmv ? fmt('count', gmv.failed) : '0' },
                ]}
              />
            </section>
            {d.tickets.length > 0 && (
              <section className="bg-canvas px-6 py-2" aria-label="Ticket types">
                <Table minWidth={420} head={['Ticket', { label: 'Price', align: 'right' }, { label: 'Sold', align: 'right' }, { label: 'Checked in', align: 'right' }]}>
                  {d.tickets.map((t) => (
                    <tr key={t.id} className="h-10 border-b border-line">
                      <td className={`${tdFirst} max-w-[160px] truncate`}>{t.name ?? `#${t.id}`}</td>
                      <td className={`num ${td} text-right`}>{t.price ? fmt('money', t.price, cur) : 'Free'}</td>
                      <td className={`num ${td} text-right`}>
                        {fmt('count', t.sold)}/{fmt('count', t.capacity)}
                      </td>
                      <td className={`num ${tdLast} text-right`}>{fmt('count', t.scanned)}</td>
                    </tr>
                  ))}
                </Table>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
