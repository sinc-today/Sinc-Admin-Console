'use client';

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, QueryPanel, fmt } from '@/components/analytics-ui';
import { BigNumber, Facts, RowLink, dayFmt } from '@/components/directory-ui';
import { useAnalytics, useScopeParams } from '@/lib/analytics';
import { PagerBar, useOffsetPager } from '@/components/pager';

interface NoSale {
  id: number;
  name: string;
  organizerProfileId: number;
  organizer: string | null;
  createdAt: string;
  startDate: string;
}
import { C, axisTick } from '@/lib/chart-theme';
import { useCan } from '../me-context';

interface Summary {
  events: { created: number; createdPrivate: number; upcoming: number; live: number; ended: number; onSale: number; free: number; paid: number; featured: number; onsite: number; virtual: number };
  organizers: { total: number; approved: number; pending: number; declined: number; kyc: number; created: number; active: number; withSales: number };
  concentration: { top10Share: number | null; organizersWithSales: number };
}

export default function MarketplacePage() {
  const can = useCan('analytics.read');
  const { currency } = useScopeParams();
  const s = useAnalytics<Summary>('/marketplace/summary');
  const sell = useAnalytics<{ buckets: { bucket: string; events: number }[] }>('/marketplace/sell-through');
  const cats = useAnalytics<{ categories: { category: string; events: number; tickets: number }[] }>('/marketplace/categories');
  const { params: scopeParams } = useScopeParams();
  const none = useOffsetPager<NoSale, { events: NoSale[]; hasMore: boolean }>('/marketplace/no-sales', scopeParams, (r) => ({ items: r.events, hasMore: r.hasMore }), { initialSize: 10 });
  const aff = useAnalytics<{ programs: number; affiliates: number; usage: number; earned: number }>('/marketplace/affiliates');
  if (!can) return <NoAccess />;
  const d = s.data;
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="Events on sale now" value={d ? fmt('count', d.events.onSale) : '…'} sub={d ? `${d.events.live} live right now · ${d.events.upcoming} upcoming` : undefined} />
        <BigNumber label="Public events created" value={d ? fmt('count', d.events.created) : '…'} sub={d ? `plus ${d.events.createdPrivate} private, in this period` : undefined} />
        <BigNumber label="Organizers selling" value={d ? fmt('count', d.organizers.withSales) : '…'} sub={d ? `of ${d.organizers.total} organizers · ${d.organizers.created} new` : undefined} />
        <BigNumber
          label="GMV from the top 10 organizers"
          value={d ? fmt('ratio', d.concentration.top10Share) : '…'}
          sub={`Share of ${currency} GMV in this period`}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Sell-through for events in this period" query={sell} freshness="Tickets issued ÷ capacity, for events starting in the range.">
          {(x) => (
            <div className="h-[240px]" role="img" aria-label={x.buckets.map((b) => `${b.bucket}: ${b.events} events`).join(', ')}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={x.buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="bucket" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={40} />
                  <Tooltip cursor={{ fill: 'var(--surface-fog)' }} contentStyle={{ border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 }} />
                  <Bar name="Events" dataKey="events" fill={C.ink} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </QueryPanel>
        <QueryPanel title="Tickets by category" query={cats} skeleton="list">
          {(x) => <BarList rows={x.categories.map((c) => ({ label: c.category, sub: `${c.events} events`, value: c.tickets }))} unit="count" empty="No events in this period." />}
        </QueryPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Catalog right now" query={s} skeleton="list">
          {(x) => (
            <div className="flex flex-col gap-6">
              <Facts
                items={[
                  { label: 'Paid events', value: fmt('count', x.events.paid) },
                  { label: 'Free events', value: fmt('count', x.events.free) },
                  { label: 'Featured', value: fmt('count', x.events.featured) },
                  { label: 'Virtual', value: fmt('count', x.events.virtual) },
                ]}
              />
              <Facts
                items={[
                  { label: 'Approved organizers', value: fmt('count', x.organizers.approved) },
                  { label: 'Waiting for verification', value: <Link className="underline decoration-ember underline-offset-4" href="/organizers?verification=PENDING">{fmt('count', x.organizers.pending)}</Link> },
                  { label: 'KYC approved', value: fmt('count', x.organizers.kyc) },
                  { label: 'Declined', value: fmt('count', x.organizers.declined) },
                ]}
              />
            </div>
          )}
        </QueryPanel>
        <QueryPanel title="Affiliate programs" query={aff} skeleton="list" freshness="Events still running or ended in this period.">
          {(x) => (
            <Facts
              items={[
                { label: 'Events with affiliates', value: fmt('count', x.programs) },
                { label: 'Affiliates', value: fmt('count', x.affiliates) },
                { label: 'Tickets via affiliates', value: fmt('count', x.usage) },
                { label: 'Tickets per affiliate', value: fmt('count', x.affiliates ? x.usage / x.affiliates : null), hint: 'Commission amounts are not summed here because events sell in different currencies.' },
              ]}
            />
          )}
        </QueryPanel>
      </div>

      <QueryPanel title="Events with no sales yet" query={none} skeleton="table" freshness="Upcoming events published over 7 days ago with no tickets issued. Soonest first.">
        {(x) =>
          x.events.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">Every published event has sold at least one ticket.</p>
          ) : (
            <>
            <ul className="hover-list flex flex-col">
              {x.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-3 text-[13px]">
                  <span className="min-w-0">
                    <RowLink href={`/events/${e.id}`}>{e.name}</RowLink>
                    {e.organizer && (
                      <span className="ml-2 text-ink-muted">
                        by <Link href={`/organizers/${e.organizerProfileId}`} className="hover:underline">{e.organizer}</Link>
                      </span>
                    )}
                  </span>
                  <span className="num text-ink-secondary">Starts {dayFmt(e.startDate)}</span>
                </li>
              ))}
            </ul>
            <PagerBar pager={none} noun="events" sizes={[10, 25, 50]} />
            </>
          )
        }
      </QueryPanel>
    </div>
  );
}
