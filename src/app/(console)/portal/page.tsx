'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt, humanize } from '@/components/analytics-ui';
import { BigNumber, ExportButton, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { PagerBar, useCursorPager, useOffsetPager } from '@/components/pager';
import Link from 'next/link';
import { EmptyState, ErrorState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { C, axisTick } from '@/lib/chart-theme';
import { useCan, useMe } from '../me-context';

interface PartnerInfo {
  partner: { id: number; name: string; countries: string[]; status: string };
  terms: { royaltyPct: number; blockerPct: number; blockerSincPct: number; effectiveFrom: string; blockerLabel: string | null } | null;
  nextTerms: { royaltyPct: number; blockerPct: number; blockerSincPct: number; effectiveFrom: string } | null;
  viewer: 'staff' | 'partner';
  partners?: { id: number; name: string }[];
}
interface Earnings {
  currency: string;
  totals: { currency: string; sales: number; ticketMoney: number; operatorShare: number; commission: number; aggregatorFees: number; sincRoyalty: number; blocker: number; shareOfTickets: number | null }[];
  daily: { t: string; v: number; sales: number }[];
  allTimeCredits: { credited: { amount: number; count: number }; waiting: { amount: number; count: number }; failed: { amount: number; count: number } };
}
type Counts = { transactions: number; tickets: number; events: number; activeUsers: number; newInstalls: number };

const COUNTRY: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda' };
const MEASURES: { key: keyof Counts; label: string; hint: string }[] = [
  { key: 'transactions', label: 'Payments', hint: 'Successful payments for tickets and products' },
  { key: 'tickets', label: 'Tickets', hint: 'Tickets issued for events in your countries' },
  { key: 'activeUsers', label: 'Active users', hint: 'People who used Sinc from your countries in the period' },
  { key: 'newInstalls', label: 'New installs', hint: 'App installs linked to an account in your countries' },
  { key: 'events', label: 'Events', hint: 'Events happening in your countries in the period' },
];
const TABS = [
  { key: 'earnings', label: 'Earnings' },
  { key: 'events', label: 'Share per event' },
  { key: 'statement', label: 'Statements' },
  { key: 'country', label: 'My countries' },
  { key: 'ranking', label: 'Partner ranking' },
] as const;
interface StatementRow {
  sales: number;
  gross: number;
  commission: number;
  aggregatorFee: number;
  royalty: number;
  operatorShare: number;
}
const shortDay = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const pct = (v: number) => `${Number(v.toFixed(3))}%`;

export default function PortalPage() {
  const can = useCan('partner.portal');
  const me = useMe();
  const [s, setS] = useQueryStates({ tab: parseAsString.withDefault('earnings'), partnerId: parseAsInteger });
  const { params } = useScopeParams();
  const base = new URLSearchParams({ from: params.get('from')!, to: params.get('to')! });
  if (s.partnerId && !me.staff.partnerId) base.set('partnerId', String(s.partnerId));
  const info = useQuery({ queryKey: ['portal', 'partner', s.partnerId], queryFn: () => api<PartnerInfo>(`/portal/partner${s.partnerId && !me.staff.partnerId ? `?partnerId=${s.partnerId}` : ''}`), enabled: can });
  if (!can) return <NoAccess />;
  if (info.isLoading) return <Skeleton className="h-[480px] w-full" />;
  // Staff opening the dashboard before any partner exists: explain, instead of showing an error.
  if (info.error && !me.staff.partnerId && (info.error as ApiError).status === 403)
    return (
      <EmptyState
        title="No partners yet"
        body="Add a partner first to preview what they see."
        action={
          <Link href="/partners" className="display inline-flex h-10 items-center border border-ink px-4 text-[15px] text-ink hover:bg-fog">
            Go to Partners
          </Link>
        }
      />
    );
  if (info.error) return <ErrorState message={(info.error as Error).message} requestId={(info.error as ApiError).requestId} onRetry={() => info.refetch()} />;
  const d = info.data!;
  const t = d.terms;
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="display break-words text-[24px] leading-tight text-ink sm:text-[32px]">{d.partner.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              Licence partner for {d.partner.countries.map((c) => COUNTRY[c] ?? c).join(' and ')}
              {t && ` · Sinc royalty ${pct(t.royaltyPct)} of the ticket price`}
              {t && t.blockerPct > 0 && ` · ${t.blockerLabel || 'blocker'} ${pct(t.blockerPct)}`}
              {d.nextTerms && ` · from ${d.nextTerms.effectiveFrom}: royalty ${pct(d.nextTerms.royaltyPct)}`}
            </p>
          </div>
          {d.viewer === 'staff' && d.partners && (
            <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
              Viewing as
              <select className="h-9 border border-line-strong bg-canvas px-2 text-ink" value={d.partner.id} onChange={(e) => setS({ partnerId: Number(e.target.value) })}>
                {d.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Panel>
      <nav aria-label="Partner dashboard" className="relative -mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-current={s.tab === x.key ? 'page' : undefined}
            onClick={() => setS({ tab: x.key === 'earnings' ? null : x.key })}
            className={`display inline-flex h-10 items-center rounded-pill px-4 text-[15px] ${s.tab === x.key ? 'bg-canvas text-ink' : 'text-ink-secondary hover:bg-fog'}`}
          >
            {x.label}
          </button>
        ))}
      </nav>
      {s.tab === 'earnings' && <EarningsTab q={base} />}
      {s.tab === 'events' && <EventsTab q={base} />}
      {s.tab === 'statement' && <StatementTab q={base} />}
      {s.tab === 'country' && <CountryTab q={base} />}
      {s.tab === 'ranking' && <RankingTab q={base} />}
    </div>
  );
}

function EarningsTab({ q }: { q: URLSearchParams }) {
  const e = useQuery({ queryKey: ['portal', 'earnings', q.toString()], queryFn: () => api<Earnings>(`/portal/earnings?${q}`), placeholderData: (p) => p });
  const sales = useCursorPager<{ transactionId: number; at: string; eventName: string | null; gross: number; operatorShare: number; currency: string; operatorStatus: string | null }>('/portal/sales', q, { urlSize: false, initialSize: 10 });
  if (e.isLoading) return <Skeleton className="h-60 w-full" />;
  if (e.error) return <ErrorState message={(e.error as Error).message} onRetry={() => e.refetch()} />;
  const d = e.data!;
  const t = d.totals.find((x) => x.currency === d.currency) ?? d.totals[0];
  const cur = t?.currency ?? d.currency;
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="Your share in this period" value={fmt('money', t?.operatorShare ?? 0, cur, true)} sub={`${fmt('count', t?.sales ?? 0)} payments`} />
        <BigNumber label="Of the ticket price" value={t?.shareOfTickets != null ? `${(t.shareOfTickets * 100).toFixed(2)}%` : '–'} sub={`${fmt('money', t?.ticketMoney ?? 0, cur, true)} in tickets`} />
        <BigNumber label="Credited to your account" value={fmt('money', d.allTimeCredits.credited.amount, cur, true)} sub="All time, into your Sinc operator account" />
        <BigNumber label="On its way" value={fmt('money', d.allTimeCredits.waiting.amount + d.allTimeCredits.failed.amount, cur, true)} sub={d.allTimeCredits.failed.count ? 'Some credits are delayed; Sinc is on it' : 'Usually within a few minutes of each sale'} />
      </section>
      <Panel title="Your share per day" freshness={t ? `Commission ${fmt('money', t.commission, cur, true)}, minus provider fees ${fmt('money', t.aggregatorFees, cur, true)}, Sinc royalty ${fmt('money', t.sincRoyalty, cur, true)}${t.blocker ? ` and blocker ${fmt('money', t.blocker, cur, true)}` : ''}.` : undefined}>
        <div className="h-[260px]" role="img" aria-label={`Your share per day in ${cur}, totalling ${fmt('money', t?.operatorShare ?? 0, cur)}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.line} />
              <XAxis dataKey="t" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => fmt('money', v, cur, true).replace(/^(RWF|UGX)\s/, '')} />
              <Tooltip contentStyle={{ border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 }} labelFormatter={(l) => shortDay(String(l))} formatter={(v) => [fmt('money', Number(v), cur), 'Your share']} />
              <Line dataKey="v" stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Latest payments" freshness="Each payment in your countries and the share it earned you.">
        {!sales.items.length ? (
          <p className="py-2 text-[13px] text-ink-muted">No payments yet.</p>
        ) : (
          <>
            <Table minWidth={620} head={['When', 'Event', { label: 'Ticket', align: 'right' }, { label: 'Your share', align: 'right' }, 'Credited']}>
              {sales.items.map((x) => (
                <tr key={x.transactionId} className="h-10 border-b border-line">
                  <td className={`num ${tdFirst} whitespace-nowrap text-ink-secondary`}>{new Date(x.at).toLocaleString('en-GB', { timeZone: 'Africa/Kigali', dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className={`${td} max-w-[240px] truncate`}>{x.eventName ?? '–'}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', x.gross, x.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', x.operatorShare, x.currency)}</td>
                  <td className={tdLast}>{x.operatorStatus === 'applied' ? <StatusBadge status="ok">Credited</StatusBadge> : x.operatorShare > 0 ? <StatusBadge status="pending">On its way</StatusBadge> : <span className="text-[12px] text-ink-muted">No share</span>}</td>
                </tr>
              ))}
            </Table>
            <PagerBar pager={sales} noun="payments" sizes={[10, 25, 50]} />
          </>
        )}
      </Panel>
    </>
  );
}

function EventsTab({ q }: { q: URLSearchParams }) {
  const pager = useOffsetPager<{ rank: number; eventId: number | null; name: string | null; currency: string; sales: number; gross: number; operatorShare: number; sharePct: number | null }, { items: never[]; total: number }>(
    '/portal/events',
    q,
    (r) => ({ items: r.items, total: r.total }),
    { initialSize: 25 }
  );
  return (
    <Panel title="Your share per event" freshness="For the period at the top. The percentage differs by event because each organizer's commission and each payment provider's fee differ.">
      {pager.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : pager.error ? (
        <ErrorState message={(pager.error as Error).message} onRetry={() => pager.refetch()} />
      ) : !pager.items.length ? (
        <p className="py-2 text-[13px] text-ink-muted">No shared sales in this period.</p>
      ) : (
        <>
          <Table minWidth={640} head={[{ label: 'Rank', align: 'right' }, 'Event', { label: 'Payments', align: 'right' }, { label: 'Tickets', align: 'right' }, { label: 'Your share', align: 'right' }, { label: 'Of ticket price', align: 'right' }]}>
            {pager.items.map((e) => (
              <tr key={`${e.eventId}-${e.currency}`} className="h-11 border-b border-line">
                <td className={`num ${tdFirst} text-right`}>#{e.rank}</td>
                <td className={`${td} max-w-[300px] truncate`}>{e.name ?? (e.eventId ? `Event #${e.eventId}` : 'Not matched to an event')}</td>
                <td className={`num ${td} text-right`}>{fmt('count', e.sales)}</td>
                <td className={`num ${td} text-right`}>{fmt('money', e.gross, e.currency)}</td>
                <td className={`num ${td} text-right`}>{fmt('money', e.operatorShare, e.currency)}</td>
                <td className={`num ${tdLast} text-right`}>{e.sharePct === null ? '–' : `${(e.sharePct * 100).toFixed(2)}%`}</td>
              </tr>
            ))}
          </Table>
          <PagerBar pager={pager} noun="events" />
        </>
      )}
    </Panel>
  );
}

function StatementTab({ q }: { q: URLSearchParams }) {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date()).slice(0, 7));
  const p = new URLSearchParams(q);
  p.delete('from');
  p.delete('to');
  p.set('month', month);
  const st = useQuery({
    queryKey: ['portal', 'statement', p.toString()],
    queryFn: () => api<{ byCurrency: { currency: string; totals: StatementRow; byGateway: (StatementRow & { gateway: string })[] }[]; operatorCredited: { amount: number; count: number } }>(`/portal/statement?${p}`),
  });
  return (
    <Panel
      title="Monthly statement"
      freshness="Sales by the month they happened (Kigali time). Use the CSV for your accounts; tax is handled by your business."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="ps-month" className="sr-only">
            Month
          </label>
          <input id="ps-month" type="month" className="h-10 border border-line-strong bg-canvas px-2 text-[14px]" value={month} onChange={(e) => setMonth(e.target.value)} />
          <ExportButton path="/portal/statement.csv" params={p} label="CSV" />
        </div>
      }
    >
      {st.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : st.error ? (
        <ErrorState message={(st.error as Error).message} onRetry={() => st.refetch()} />
      ) : !st.data?.byCurrency.length ? (
        <p className="py-2 text-[13px] text-ink-muted">No shared sales in this month.</p>
      ) : (
        st.data.byCurrency.map((b) => (
          <div key={b.currency} className="flex flex-col gap-3">
            <Table minWidth={720} head={['Paid with', { label: 'Payments', align: 'right' }, { label: 'Tickets', align: 'right' }, { label: 'Commission', align: 'right' }, { label: 'Provider fees', align: 'right' }, { label: 'Sinc royalty', align: 'right' }, { label: 'Your share', align: 'right' }]}>
              {[...b.byGateway, { gateway: 'Total', ...b.totals }].map((g) => (
                <tr key={g.gateway} className={`h-11 border-b border-line ${g.gateway === 'Total' ? 'font-medium' : ''}`}>
                  <td className={tdFirst}>{g.gateway === 'Total' ? 'Total' : humanize(g.gateway)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', g.sales)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.gross, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.commission, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.aggregatorFee, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.royalty, b.currency)}</td>
                  <td className={`num ${tdLast} text-right`}>{fmt('money', g.operatorShare, b.currency)}</td>
                </tr>
              ))}
            </Table>
            <p className="text-[12px] text-ink-muted">Credited so far for this month: {fmt('money', st.data!.operatorCredited.amount, b.currency)}.</p>
          </div>
        ))
      )}
    </Panel>
  );
}

function CountryTab({ q }: { q: URLSearchParams }) {
  const c = useQuery({ queryKey: ['portal', 'country', q.toString()], queryFn: () => api<{ countries: string[]; current: Counts; previous: Counts }>(`/portal/country?${q}`), placeholderData: (p) => p });
  if (c.isLoading) return <Skeleton className="h-40 w-full" />;
  if (c.error) return <ErrorState message={(c.error as Error).message} onRetry={() => c.refetch()} />;
  const d = c.data!;
  return (
    <section aria-label="Your countries" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
      {MEASURES.map((m) => {
        const now = d.current[m.key];
        const before = d.previous[m.key];
        const delta = before > 0 ? (now - before) / before : null;
        return <BigNumber key={m.key} label={m.label} value={fmt('count', now)} sub={`${delta === null ? 'No earlier data' : `${delta >= 0 ? 'Up' : 'Down'} ${Math.abs(delta * 100).toFixed(0)}% on the previous period`}. ${m.hint}.`} />;
      })}
    </section>
  );
}

function RankingTab({ q }: { q: URLSearchParams }) {
  const r = useQuery({
    queryKey: ['portal', 'ranking', q.toString()],
    queryFn: () => api<{ items: { id: number; name: string; countries: string[]; me: boolean; counts: Counts; ranks: Record<keyof Counts, number> }[] }>(`/portal/ranking?${q}`),
    placeholderData: (p) => p,
  });
  return (
    <Panel title="Partner ranking" freshness="Every licence partner, ranked on activity in their countries for the period. Counts only: no partner sees another's money.">
      {r.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : r.error ? (
        <ErrorState message={(r.error as Error).message} onRetry={() => r.refetch()} />
      ) : (
        <Table minWidth={760} head={['Partner', ...MEASURES.map((m) => ({ label: m.label, align: 'right' as const }))]}>
          {r.data!.items.map((x) => (
            <tr key={x.id} className={`h-11 border-b border-line ${x.me ? 'bg-fog font-medium' : ''}`}>
              <td className={tdFirst}>
                {x.name}
                {x.me && <span className="ml-2 text-[12px] text-ink-secondary">(you)</span>}
                <div className="text-[12px] font-normal text-ink-muted">{x.countries.map((c) => COUNTRY[c] ?? c).join(', ')}</div>
              </td>
              {MEASURES.map((m, i) => (
                <td key={m.key} className={`num ${i === MEASURES.length - 1 ? tdLast : td} text-right`}>
                  <span className="text-ink">#{x.ranks[m.key]}</span>
                  <span className="ml-2 text-[12px] text-ink-muted">{fmt('count', x.counts[m.key])}</span>
                </td>
              ))}
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}
