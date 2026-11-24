'use client';

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QueryPanel, fmt, humanize } from '@/components/analytics-ui';
import { BigNumber, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { useAnalytics } from '@/lib/analytics';
import { C, axisTick } from '@/lib/chart-theme';

const shortDay = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const tip = { border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 };

/* ------------------------------------------------------------------ income and expenses */
interface Income {
  currency: string;
  exactFrom: string | null;
  estimatedPart: boolean;
  totals: { commission: number; fee: number; net: number; gross: number; partnerShares: number; blockerShares: number; sincKeep: number; takeRate: number | null; feeShareOfCommission: number | null };
  byGateway: { gateway: string; gross: number; fee: number; sales: number; estimated: boolean; feeRate: number | null }[];
  daily: { t: string; commission: number; fee: number; net: number }[];
  missingFees: { provider: string; country: string; currency: string; payments: number }[];
}

export function IncomeTab() {
  const q = useAnalytics<Income>('/money/income');
  const d = q.data;
  const cur = d?.currency ?? 'RWF';
  const note = !d
    ? undefined
    : d.exactFrom && !d.estimatedPart
      ? 'Exact, from the split each sale reports.'
      : d.exactFrom
        ? `Exact from ${new Date(d.exactFrom).toLocaleDateString('en-GB')}; earlier days estimated from GMV × the fee schedule in force.`
        : 'Estimated: GMV × the fee schedule in force each day. Exact figures start when the events service reports sale splits.';
  return (
    <>
      {!!d?.missingFees?.length && (
        <p role="alert" className="rounded-panel bg-canvas p-4 text-[13px] text-ink outline outline-1 outline-ember">
          No fee set for {d.missingFees.map((m) => `${humanize(m.provider)} (${m.country}, ${fmt('count', m.payments)} payments)`).join(', ')}. Fees show too low.{' '}
          <Link href="/settings/fees" className="underline underline-offset-4">
            Set the rate
          </Link>
        </p>
      )}
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="Gross commission" value={d ? fmt('money', d.totals.commission, cur, true) : '…'} sub={d ? `${fmt('ratio', d.totals.takeRate)} of ${fmt('money', d.totals.gross, cur, true)} GMV` : undefined} />
        <BigNumber label="Aggregator fees" value={d ? fmt('money', d.totals.fee, cur, true) : '…'} sub={d ? `${fmt('ratio', d.totals.feeShareOfCommission)} of commission` : undefined} />
        <BigNumber
          label={d && d.totals.partnerShares + d.totals.blockerShares > 0 ? 'Sinc keeps' : 'Net commission'}
          value={d ? fmt('money', d.totals.sincKeep, cur, true) : '…'}
          sub={d && d.totals.partnerShares + d.totals.blockerShares > 0 ? `After ${fmt('money', d.totals.partnerShares + d.totals.blockerShares, cur, true)} to partners` : undefined}
          tip="Commission minus aggregator fees, minus partner and blocker shares."
        />
        <BigNumber label="Data" value={d ? (d.estimatedPart ? (d.exactFrom ? 'Partly estimated' : 'Estimated') : 'Exact') : '…'} tip={note} />
      </section>

      <QueryPanel title="Commission and fees per day" query={q} info={note}>
        {(x) => (
          <div className="h-[280px]" role="img" aria-label={`Gross commission, aggregator fees and net commission per day in ${x.currency}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={x.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="t" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => fmt('money', v, x.currency, true).replace(/^(RWF|UGX)\s/, '')} />
                <Tooltip contentStyle={tip} labelFormatter={(l) => shortDay(String(l))} formatter={(v, n) => [fmt('money', Number(v), x.currency), n]} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Line name="Gross commission" dataKey="commission" stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="Net commission" dataKey="net" stroke={C.brass} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <Line name="Aggregator fees" dataKey="fee" stroke={C.emberData} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </QueryPanel>

      <QueryPanel title="Aggregator fees by provider" query={q} skeleton="table" freshness="Fee rate = fees ÷ money collected through that provider.">
        {(x) =>
          x.byGateway.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No provider payments in this period.</p>
          ) : (
            <Table minWidth={640} head={['Provider', { label: 'Payments', align: 'right' }, { label: 'Collected', align: 'right' }, { label: 'Fees', align: 'right' }, { label: 'Fee rate', align: 'right' }]}>
              {x.byGateway.map((g) => (
                <tr key={g.gateway} className="h-11 border-b border-line">
                  <td className={tdFirst}>
                    {humanize(g.gateway)}
                    {g.estimated && <span className="ml-2 text-[12px] text-ink-muted">estimated</span>}
                  </td>
                  <td className={`num ${td} text-right`}>{fmt('count', g.sales)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.gross, x.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.fee, x.currency)}</td>
                  <td className={`num ${tdLast} text-right`}>{fmt('ratio', g.feeRate)}</td>
                </tr>
              ))}
            </Table>
          )
        }
      </QueryPanel>
    </>
  );
}

/* ------------------------------------------------------------------ SMS */
interface Sms {
  storedColumns: boolean;
  currency: string;
  totals: { messages: number; parts: number; deliveryRate: number | null; failed: number; cost: Record<string, number>; costPerTicket: number | null };
  byGateway: { gateway: string; country: string; messages: number; parts: number; delivered: number; failed: number; cost: number; currency: string | null; priced: boolean }[];
  byPayer: { payer: string; messages: number }[];
  daily: { t: string; messages: number; cost: number }[];
}

const COUNTRY: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda', OTHER: 'Other' };

export function SmsTab() {
  const q = useAnalytics<Sms>('/money/sms');
  const d = q.data;
  const costs = d ? Object.entries(d.totals.cost) : [];
  return (
    <>
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="Messages sent" value={d ? fmt('count', d.totals.messages) : '…'} sub={d ? `${fmt('count', d.totals.parts)} billed parts` : undefined} />
        <BigNumber label="SMS cost" value={d ? (costs.length ? costs.map(([c, v]) => fmt('money', v, c, true)).join(' · ') : 'None') : '…'} tip="Monitoring only, never deducted from anyone's share." />
        <BigNumber label="Delivered" value={d ? fmt('ratio', d.totals.deliveryRate) : '…'} sub={d ? `${fmt('count', d.totals.failed)} failed or undelivered` : undefined} />
        <BigNumber label="SMS cost per ticket" value={d ? (d.totals.costPerTicket === null ? 'No data' : fmt('money', d.totals.costPerTicket, d.currency)) : '…'} tip="SMS cost in this currency ÷ tickets issued." />
      </section>

      <QueryPanel
        title="Messages and cost per day"
        query={q}
        freshness={
          d && !d.storedColumns
            ? 'Parts are worked out from the text and priced with the SMS rate cards; provider-reported costs appear once the events service update is deployed.'
            : 'Provider-reported cost where available, otherwise parts × the SMS rate card in force that day.'
        }
      >
        {(x) => (
          <div className="h-[260px]" role="img" aria-label={`SMS messages per day and their cost in ${x.currency}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={x.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="t" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
                <YAxis yAxisId="m" tick={axisTick} axisLine={false} tickLine={false} width={44} />
                <YAxis yAxisId="c" orientation="right" tick={axisTick} axisLine={false} tickLine={false} width={56} />
                <Tooltip contentStyle={tip} cursor={{ fill: 'var(--surface-fog)' }} labelFormatter={(l) => shortDay(String(l))} />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="m" name="Messages" dataKey="messages" fill={C.ink} isAnimationActive={false} />
                <Bar yAxisId="c" name={`Cost (${x.currency})`} dataKey="cost" fill={C.emberData} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </QueryPanel>

      <QueryPanel title="By gateway and destination" query={q} skeleton="table" freshness="Delivered share counts messages with a delivery report.">
        {(x) => (
          <>
            <Table minWidth={720} head={['Gateway', 'Destination', { label: 'Messages', align: 'right' }, { label: 'Parts', align: 'right' }, { label: 'Delivered', align: 'right' }, { label: 'Cost', align: 'right' }]}>
              {x.byGateway.map((g) => (
                <tr key={`${g.gateway}-${g.country}`} className="h-11 border-b border-line">
                  <td className={tdFirst}>{g.gateway === 'AFRICA_STALKING' ? "Africa's Talking" : humanize(g.gateway)}</td>
                  <td className={`${td} text-ink-secondary`}>{COUNTRY[g.country] ?? g.country}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', g.messages)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', g.parts)}</td>
                  <td className={`num ${td} text-right`}>{fmt('ratio', g.delivered + g.failed > 0 ? g.delivered / (g.delivered + g.failed) : null)}</td>
                  <td className={`num ${tdLast} text-right`}>{g.priced && g.currency ? fmt('money', g.cost, g.currency) : <span className="text-ink-muted">No rate set</span>}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-[12px] text-ink-muted">
              Paid by: {x.byPayer.map((p) => `${p.payer === 'ORGANIZER' ? 'organizers (bulk SMS)' : 'Sinc (tickets, codes)'} ${fmt('count', p.messages)}`).join(' · ') || 'no messages'}
            </p>
          </>
        )}
      </QueryPanel>
    </>
  );
}
