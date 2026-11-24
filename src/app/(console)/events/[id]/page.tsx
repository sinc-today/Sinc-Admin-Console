'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLink } from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, fmt, humanize } from '@/components/analytics-ui';
import { Facts, RowLink, Table, dayFmt, td, tdFirst, tdLast } from '@/components/directory-ui';
import { ErrorState, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { C, axisTick } from '@/lib/chart-theme';
import { formatDateTime } from '@/lib/format';
import { Flyer } from '@/components/Flyer';
import { FeePayerPanel, type FeePayer } from '@/components/FeePayer';
import { ResendTicketsButton } from '@/components/ResendTickets';
import { EventAttendees } from '@/components/EventAttendees';
import { EventPrivacyButton, FeatureEventButton, GenerateTicketsButton } from '@/components/EventActions';
import { useCan } from '../../me-context';

interface Event360 {
  event: {
    id: number;
    name: string;
    flyer: string | null;
    organizerProfileId: number | null;
    organizer: string | null;
    category: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    country: string | null;
    currency: string | null;
    privacy: string | null;
    setup: string | null;
    locationName: string | null;
    feePayer?: FeePayer;
    isFeatured?: boolean;
    tz: string;
  };
  totals: { sold: number; available: number; capacity: number; sellThrough: number | null; scanned: number; checkInRate: number | null };
  tickets: { id: number; name: string | null; price: number; available: number; sold: number; scanned: number; disabled: boolean; capacity: number }[];
  salesCurve: { t: string; v: number; n: number }[];
  channels: { channel: string; count: number; amount: number }[];
  checkIn: { hour: string; n: number }[];
  affiliates: { userId: number; status: string | null; percentage: number | null; totalUsage: number; totalCommissionEarned: number }[];
  money: { currency: string; gmv: number; payments: number; failed: number }[];
  linkedTransactions: number;
  rank: { position: number; of: number; processed: number } | null;
}

const shortDay = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
const tip = { border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 };

export default function EventPage() {
  const can = useCan('analytics.read');
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['event', id], queryFn: () => api<Event360>(`/events/${id}`), enabled: can });
  if (!can) return <NoAccess />;
  if (q.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const e = d.event;
  const now = Date.now();
  const status = new Date(e.startDate).getTime() > now ? (['info', 'Upcoming'] as const) : new Date(e.endDate).getTime() >= now ? (['ok', 'Live now'] as const) : (['pending', 'Ended'] as const);
  const cur = e.currency ?? 'RWF';
  const gmv = d.money.find((m) => m.currency === cur) ?? d.money[0];
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-secondary">
        <AppLink href="/events" className="hover:underline">
          Events
        </AppLink>{' '}
        / <span className="text-ink">#{e.id}</span>
      </nav>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
          <Flyer src={e.flyer} name={e.name} className="h-28 w-[90px]" />
          <div className="min-w-0">
            <h2 className="display text-[32px] leading-tight text-ink">{e.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {formatDateTime(e.startDate, e.tz)} to {formatDateTime(e.endDate, e.tz)}
              {e.locationName && ` · ${e.locationName}`}
              {e.organizerProfileId && (
                <>
                  {' '}
                  · by <RowLink href={`/organizers/${e.organizerProfileId}`}>{e.organizer ?? `Organizer #${e.organizerProfileId}`}</RowLink>
                </>
              )}
            </p>
            {d.rank && d.rank.processed > 0 && (
              <p className="mt-1 text-[13px] text-ink-secondary">
                Ranked #{fmt('count', d.rank.position)} of {fmt('count', d.rank.of)} {cur} events by amount processed ({fmt('money', d.rank.processed, cur)})
              </p>
            )}
          </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={status[0]}>{status[1]}</StatusBadge>
            {e.category && <Tag>{e.category}</Tag>}
            {e.privacy === 'PRIVATE' && <Tag>Private</Tag>}
            {e.setup === 'VIRTUAL' && <Tag>Virtual</Tag>}
            {e.feePayer === 'BUYER' && <Tag>Buyer pays fee</Tag>}
            {e.isFeatured && <Tag>Featured</Tag>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ResendTicketsButton eventId={e.id} eventName={e.name} />
          <GenerateTicketsButton eventId={e.id} eventName={e.name} currency={e.currency} />
          <FeatureEventButton eventId={e.id} featured={!!e.isFeatured} />
          <EventPrivacyButton eventId={e.id} privacy={e.privacy} />
        </div>
        <div className="mt-6">
          <Facts
            cols={6}
            items={[
              { label: 'Tickets issued', value: fmt('count', d.totals.sold) },
              { label: 'Capacity', value: fmt('count', d.totals.capacity) },
              { label: 'Sell-through', value: fmt('ratio', d.totals.sellThrough) },
              { label: 'Checked in', value: `${fmt('count', d.totals.scanned)} (${fmt('ratio', d.totals.checkInRate)})` },
              { label: `GMV (${gmv?.currency ?? cur})`, value: gmv ? fmt('money', gmv.gmv, gmv.currency, true) : 'No payments', hint: 'Successful provider payments linked to this event' },
              { label: 'Failed payments', value: gmv ? fmt('count', gmv.failed) : '0' },
            ]}
          />
        </div>
      </Panel>

      <EventAttendees eventId={e.id} eventName={e.name} totals={{ sold: d.totals.sold, scanned: d.totals.scanned }} />

      <FeePayerPanel eventId={e.id} value={e.feePayer ?? 'ORGANIZER'} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        <Panel title="Cumulative tickets issued" freshness={`Per day in ${e.tz.replace('Africa/', '')} time, since sales opened.`}>
          {d.salesCurve.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No tickets issued yet.</p>
          ) : (
            <div className="h-[260px]" role="img" aria-label={`${d.totals.sold} tickets issued between ${shortDay(d.salesCurve[0].t)} and ${shortDay(d.salesCurve[d.salesCurve.length - 1].t)}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.salesCurve} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="t" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
                  <Tooltip contentStyle={tip} labelFormatter={(l) => shortDay(String(l))} formatter={(v, _n, p) => [`${Number(v).toLocaleString('en')} total (+${(p.payload as { n: number }).n})`, 'Tickets']} />
                  <Area type="stepAfter" dataKey="v" stroke={C.ink} strokeWidth={2} fill="var(--surface-fog)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="How tickets were sold">
          <BarList rows={d.channels.map((c) => ({ label: humanize(c.channel), value: c.count }))} unit="count" empty="No sales recorded." />
        </Panel>
      </div>

      <Panel title="Ticket types">
        <Table minWidth={640} head={['Ticket', { label: 'Price', align: 'right' }, { label: 'Sold', align: 'right' }, { label: 'Left', align: 'right' }, { label: 'Sell-through', align: 'right' }, { label: 'Checked in', align: 'right' }]}>
          {d.tickets.map((t) => (
            <tr key={t.id} className="h-11 border-b border-line">
              <td className={tdFirst}>
                {t.name ?? `Ticket #${t.id}`}
                {t.disabled && <span className="ml-2 text-[12px] text-ink-muted">disabled</span>}
              </td>
              <td className={`num ${td} text-right`}>{t.price ? fmt('money', t.price, cur) : 'Free'}</td>
              <td className={`num ${td} text-right`}>{fmt('count', t.sold)}</td>
              <td className={`num ${td} text-right`}>{fmt('count', t.available)}</td>
              <td className={`num ${td} text-right`}>{fmt('ratio', t.capacity ? t.sold / t.capacity : null)}</td>
              <td className={`num ${tdLast} text-right`}>{fmt('count', t.scanned)}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Check-ins per hour">
          {d.checkIn.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No check-ins recorded.</p>
          ) : (
            <div className="h-[220px]" role="img" aria-label={`${d.totals.scanned} check-ins across ${d.checkIn.length} hours`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.checkIn} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="hour" tickFormatter={(h: string) => h.slice(11, 16)} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: 'var(--surface-fog)' }} contentStyle={tip} labelFormatter={(l) => `${shortDay(String(l))} ${String(l).slice(11, 16)}`} />
                  <Bar name="Check-ins" dataKey="n" fill={C.ink} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Affiliates">
          {d.affiliates.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No affiliates for this event.</p>
          ) : (
            <ul className="hover-list flex flex-col">
              {d.affiliates.map((a) => (
                <li key={a.userId} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px]">
                  <span>
                    <RowLink href={`/users/${a.userId}`}>User #{a.userId}</RowLink>
                    <span className="ml-2 text-ink-muted">
                      {a.percentage ?? 0}% · {humanize(a.status)}
                    </span>
                  </span>
                  <span className="num text-ink">
                    {fmt('count', a.totalUsage)} tickets · {fmt('money', a.totalCommissionEarned, cur, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-[12px] text-ink-muted">Created {dayFmt(e.createdAt)}. {d.linkedTransactions.toLocaleString('en')} payments linked to this event.</p>
    </div>
  );
}
