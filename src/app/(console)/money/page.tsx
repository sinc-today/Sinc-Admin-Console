'use client';

import Link from 'next/link';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, MetricTile, QueryPanel, Sparkline, Tabs, TrendChart, fmt, humanize } from '@/components/analytics-ui';
import { Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { InfoTip, InlineEmpty } from '@/components/ui';
import { TxStatus } from '@/components/TxStatus';
import { freshnessLabel, useAnalytics, useScopeParams, type Freshness, type Kpi, type Series } from '@/lib/analytics';
import { formatDateTime } from '@/lib/format';
import { tipFor } from '@/lib/glossary';
import { COMPARE_LABELS } from '@/lib/scope';
import { IncomeTab, SmsTab } from './costs';
import { useCan } from '../me-context';

const TABS = ['collections', 'payouts', 'reversals', 'revenue', 'income', 'sms'] as const;
type Tab = (typeof TABS)[number];

interface TxRow {
  id: number;
  createdAt: string;
  amount: number;
  currency: string;
  status: string;
  transactionType: string;
  paymentGateway: string | null;
  correspondent: string | null;
  errorMessage: string | null;
  organizer: string | null;
}

export default function MoneyPage() {
  const can = useCan('money.read');
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('collections'));
  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <Tabs
        tabs={[
          { key: 'collections', label: 'Collections' },
          { key: 'payouts', label: 'Payouts & wallets' },
          { key: 'reversals', label: 'Reversals' },
          { key: 'revenue', label: 'Revenue' },
          { key: 'income', label: 'Income & expenses' },
          { key: 'sms', label: 'SMS' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />
      {tab === 'collections' && <Collections />}
      {tab === 'payouts' && <Payouts />}
      {tab === 'reversals' && <Reversals />}
      {tab === 'revenue' && <Revenue />}
      {tab === 'income' && <IncomeTab />}
      {tab === 'sms' && <SmsTab />}
    </div>
  );
}

const cmpLabelFor = (c: string) => (c === 'none' ? undefined : c === 'yoy' ? 'vs last year' : 'vs previous');

function KpiRow({ kpis, cols = 4 }: { kpis?: (Kpi | undefined)[]; cols?: number }) {
  const { compare } = useScopeParams();
  const list = kpis ?? Array.from({ length: cols }).map(() => undefined);
  return (
    <section aria-label="Key numbers" className={`grid grid-cols-2 gap-3 sm:gap-5 ${cols >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {list.map((k, i) => (
        <MetricTile key={k?.key ?? i} kpi={k} compareLabel={cmpLabelFor(compare)} />
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ Collections */
interface CollectionsData {
  kpis: Kpi[];
  gmvSeries: Series;
  matrix: { gateway: string; correspondent: string; attempts: number; successRate: number | null; points: { t: string; v: number | null }[] }[];
  failures: { reason: string; count: number }[];
  timing: { p50Seconds: number | null; p90Seconds: number | null };
  stuck: { id: number; createdAt: string; amount: number; currency: string; paymentGateway: string; correspondent: string; transactionType: string }[];
  freshness: Freshness;
}

const dur = (s: number | null) => (s === null ? 'No data' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

function Collections() {
  const { currency } = useScopeParams();
  const q = useAnalytics<CollectionsData>('/money/collections');
  const br = useAnalytics<{ correspondents: { correspondent: string; amount: number; count: number }[] }>('/overview/breakdowns');
  const d = q.data;
  return (
    <>
      <KpiRow kpis={d?.kpis} />
      <QueryPanel title="Success rate by network" query={q} skeleton="table" freshness={freshnessLabel(d?.freshness)} info="Successful ÷ (successful + failed), per day. Busiest six network and provider pairs. Below 80% is highlighted.">
        {(x) =>
          x.matrix.length === 0 ? (
            <InlineEmpty>No payment attempts in this period.</InlineEmpty>
          ) : (
            <Table minWidth={620} head={['Network', 'Provider', { label: 'Attempts', align: 'right' }, { label: 'Success', align: 'right' }, 'Trend']}>
              {x.matrix.map((m) => {
                const low = m.successRate !== null && m.successRate < 0.8;
                return (
                  <tr key={`${m.gateway}-${m.correspondent}`} className="h-11 border-b border-line">
                    <td className={tdFirst}>{humanize(m.correspondent)}</td>
                    <td className={`${td} text-ink-secondary`}>{humanize(m.gateway)}</td>
                    <td className={`num ${td} text-right`}>{fmt('count', m.attempts)}</td>
                    <td className={`num ${td} text-right ${low ? 'font-medium text-ember-ink' : ''}`}>
                      {fmt('ratio', m.successRate)}
                      {low && <span className="sr-only"> (below 80%)</span>}
                    </td>
                    <td className={`${tdLast} w-[180px]`}>
                      <div className="-mt-3">
                        <Sparkline points={m.points} label={`${humanize(m.correspondent)} success rate`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )
        }
      </QueryPanel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <QueryPanel title="Why payments failed" query={q} skeleton="list">
          {(x) => (
            <BarList
              rows={x.failures.slice(0, 5).map((f) => ({ label: f.reason.charAt(0).toUpperCase() + f.reason.slice(1), value: f.count }))}
              unit="count"
              empty="No failed payments."
            />
          )}
        </QueryPanel>
        <QueryPanel title="Collections by network" query={br} skeleton="list">
          {(x) => (
            <BarList
              rows={x.correspondents.map((c) => ({ label: humanize(c.correspondent), value: c.amount, sub: c.count.toLocaleString('en') }))}
              unit="money"
              currency={currency}
              empty="No successful payments."
            />
          )}
        </QueryPanel>
        <QueryPanel title="Time to confirm" query={q} skeleton="list" info="From payment created to marked successful, for successful payments in this period.">
          {(x) => (
            <dl className="grid grid-cols-2 gap-6">
              <div>
                <dt className="text-[12px] font-medium text-ink-secondary">Median</dt>
                <dd className="display num mt-1 text-[28px] leading-tight text-ink">{dur(x.timing.p50Seconds)}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-ink-secondary">90% within</dt>
                <dd className="display num mt-1 text-[28px] leading-tight text-ink">{dur(x.timing.p90Seconds)}</dd>
              </div>
            </dl>
          )}
        </QueryPanel>
      </div>
      <QueryPanel title="Stuck payments" query={q} skeleton="table" info="Pending over 15 minutes in the last 24 hours, oldest first.">
        {(x) =>
          x.stuck.length === 0 ? (
            <InlineEmpty>No payments stuck.</InlineEmpty>
          ) : (
            <SimpleTxTable
              rows={x.stuck.map((s) => ({ ...s, status: 'PENDING', errorMessage: null, organizer: null }))}
              columns={['when', 'amount', 'network', 'type']}
            />
          )
        }
      </QueryPanel>
    </>
  );
}

/* ------------------------------------------------------------------ Payouts */
interface PayoutsData {
  paidOut: Kpi;
  wallets: { provider: string; currency: string; wallets: number; balance: number }[];
  owed: number;
  byStatus: { status: string; count: number; amount: number }[];
  failed: TxRow[];
}

function Payouts() {
  const { currency } = useScopeParams();
  const q = useAnalytics<PayoutsData>('/money/payouts');
  const d = q.data;
  const st = (s: string) => d?.byStatus.find((b) => b.status === s);
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
        <MetricTile kpi={d?.paidOut} compareLabel="vs previous" />
        <StatTile label="Owed to organizers" value={d ? fmt('money', d.owed, currency, true) : undefined} note="Organizer wallet balances right now. Not limited to the dates at the top." />
        <StatTile
          label="Failed payouts"
          value={d ? String(st('FAILED')?.count ?? 0) : undefined}
          sub={d ? `${(st('PENDING')?.count ?? 0).toLocaleString('en')} pending` : undefined}
          bad={(st('FAILED')?.count ?? 0) > 0}
        />
      </section>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Organizer balances by provider" query={q} skeleton="list">
          {(x) => (
            <BarList
              rows={x.wallets
                .filter((w) => w.currency === currency)
                .map((w) => ({ label: humanize(w.provider), value: w.balance, sub: `${w.wallets} ${w.wallets === 1 ? "wallet" : "wallets"}` }))}
              unit="money"
              currency={currency}
              empty={`No organizer wallets in ${currency}.`}
            />
          )}
        </QueryPanel>
        <QueryPanel title="Withdrawals in this period" query={q} skeleton="list">
          {(x) => (
            <BarList
              rows={x.byStatus.map((b) => ({ label: b.status === 'SUCCESS' ? 'Paid' : b.status.charAt(0) + b.status.slice(1).toLowerCase(), value: b.amount, sub: `${b.count}` }))}
              unit="money"
              currency={currency}
              empty="No withdrawals in this period."
            />
          )}
        </QueryPanel>
      </div>
      <QueryPanel title="Failed payouts" query={q} skeleton="table">
        {(x) =>
          x.failed.length === 0 ? (
            <InlineEmpty>No failed payouts.</InlineEmpty>
          ) : (
            <SimpleTxTable rows={x.failed} columns={['when', 'organizer', 'amount', 'gateway', 'reason']} />
          )
        }
      </QueryPanel>
    </>
  );
}

function StatTile({ label, value, note, sub, bad }: { label: string; value?: string; note?: string; sub?: string; bad?: boolean }) {
  return (
    <div className="flex min-h-[148px] flex-col rounded-panel bg-canvas p-5">
      <p className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
        {label}
        {(note ?? tipFor(label)) && <InfoTip label={`About ${label}`}>{note ?? tipFor(label)}</InfoTip>}
      </p>
      {value === undefined ? (
        <span className="skeleton mt-3 block h-8 w-32" role="status" aria-label={`Loading ${label}`} />
      ) : (
        <p className={`display num mt-2 text-[32px] leading-[1.19] ${bad ? 'text-ember-ink' : 'text-ink'}`}>{value}</p>
      )}
      {sub && <p className="mt-1 text-[12px] text-ink-muted">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Reversals */
function Reversals() {
  const { compare } = useScopeParams();
  const q = useAnalytics<{ kpi: Kpi; shareOfGmv: number | null; series: Series; recent: TxRow[]; freshness: Freshness }>('/money/reversals');
  const d = q.data;
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile kpi={d?.kpi} compareLabel={cmpLabelFor(compare)} />
        <StatTile label="Share of GMV" value={d ? fmt('ratio', d.shareOfGmv) : undefined} note="Reversed amount ÷ GMV in this period." />
        <StatTile label="Reversals" value={d ? d.recent.length.toLocaleString('en') + (d.recent.length === 20 ? '+' : '') : undefined} note="Up to 20 most recent are listed below." />
      </section>
      <QueryPanel title="Reversed per day" freshness={freshnessLabel(d?.freshness)} query={q}>
        {(x) => <TrendChart series={x.series} compareLabel={COMPARE_LABELS[compare]} height={240} />}
      </QueryPanel>
      <QueryPanel title="Recent reversals" query={q} skeleton="table">
        {(x) => (x.recent.length === 0 ? <InlineEmpty>No reversals.</InlineEmpty> : <SimpleTxTable rows={x.recent} columns={['when', 'organizer', 'amount', 'status']} />)}
      </QueryPanel>
    </>
  );
}

/* ------------------------------------------------------------------ Revenue */
interface RevenueData {
  commission: Kpi;
  takeRate: number | null;
  otherCharges: Kpi;
  otherByType: { type: string; amount: number; count: number }[];
  series: Series;
  topOrganizers: { id: number | null; name: string; amount: number }[];
  freshness: Freshness;
}

function Revenue() {
  const { currency, compare } = useScopeParams();
  const q = useAnalytics<RevenueData>('/money/revenue');
  const d = q.data;
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile kpi={d?.commission} compareLabel={cmpLabelFor(compare)} />
        <StatTile label="Take rate" value={d ? fmt('ratio', d.takeRate) : undefined} note="Commission revenue ÷ GMV." />
        <MetricTile kpi={d?.otherCharges} compareLabel={cmpLabelFor(compare)} />
      </section>
      <QueryPanel title="Commission revenue per day" freshness={freshnessLabel(d?.freshness)} query={q}>
        {(x) => <TrendChart series={x.series} compareLabel={COMPARE_LABELS[compare]} height={260} />}
      </QueryPanel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        <QueryPanel title="Commission by organizer" query={q} skeleton="list">
          {(x) => <BarList rows={x.topOrganizers.map((o) => ({ label: o.name, value: o.amount }))} unit="money" currency={currency} empty="No commission collected in this period." />}
        </QueryPanel>
        <QueryPanel title="Other platform charges" query={q} skeleton="list" info="Plan, message and event-post payments. Shown for context; not counted as revenue.">
          {(x) => <BarList rows={x.otherByType.map((o) => ({ label: humanize(o.type), value: o.amount, sub: `${o.count}` }))} unit="money" currency={currency} empty="No other charges." />}
        </QueryPanel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Shared table */
type Col = 'when' | 'organizer' | 'amount' | 'gateway' | 'network' | 'type' | 'status' | 'reason';

function SimpleTxTable({ rows, columns }: { rows: TxRow[]; columns: Col[] }) {
  const head: Record<Col, string> = { when: 'When (Kigali)', organizer: 'Organizer', amount: 'Amount', gateway: 'Provider', network: 'Network', type: 'Type', status: 'Status', reason: 'Reason' };
  return (
    <div className="relative -mx-4 sm:-mx-6 overflow-x-auto">
      <table className="rt w-full min-w-[720px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-fog text-left text-[12px] text-ink-secondary">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`h-10 font-medium ${i === 0 ? 'px-6' : 'px-4'} ${c === 'amount' ? 'text-right' : ''}`}>
                {head[c]}
              </th>
            ))}
            <th scope="col" className="px-6">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="h-11 border-b border-line hover:bg-fog">
              {columns.map((c, i) => (
                <td key={c} className={`${i === 0 ? 'px-6' : 'px-4'} ${c === 'amount' ? 'num text-right' : ''}`}>
                  {c === 'when' && (
                    <span className="num whitespace-nowrap text-ink-secondary">{formatDateTime(r.createdAt)}</span>
                  )}
                  {c === 'organizer' && <span className="text-ink">{r.organizer ?? 'None'}</span>}
                  {c === 'amount' && <span className="text-ink">{fmt('money', r.amount, r.currency)}</span>}
                  {c === 'gateway' && humanize(r.paymentGateway)}
                  {c === 'network' && humanize(r.correspondent)}
                  {c === 'type' && humanize(r.transactionType)}
                  {c === 'status' && <TxStatus status={r.status} />}
                  {c === 'reason' && <span className="text-ink-secondary">{r.errorMessage ?? 'No reason recorded'}</span>}
                </td>
              ))}
              <td className="px-6 text-right">
                <Link href={`/transactions/${r.id}`} className="text-[13px] text-ink underline decoration-ember underline-offset-4">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

