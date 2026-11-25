'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, MetricTile, QueryPanel, TrendChart, fmt, humanize } from '@/components/analytics-ui';
import { BigNumber, CountryCode, Facts } from '@/components/directory-ui';
import { useAnalytics, useScopeParams, type Kpi, type Series } from '@/lib/analytics';
import { C, axisTick } from '@/lib/chart-theme';
import { COMPARE_LABELS } from '@/lib/scope';
import { InfoTip, InlineEmpty } from '@/components/ui';
import { useCan } from '../me-context';

interface Summary {
  signups: Kpi;
  dau: Kpi;
  wau: number;
  mau: number;
  stickiness: number | null;
  firstPurchase7d: number | null;
  firstPurchase30d: number | null;
  firstPurchaseCohort: number;
  trackingStart: string | null;
}

const shortDay = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const tracked = (s?: string | null) => (s ? `Activity tracking started ${shortDay(s)}.` : 'Activity tracking has not started yet.');

export default function GrowthPage() {
  const can = useCan('analytics.read');
  const { compare } = useScopeParams();
  const summary = useAnalytics<Summary>('/growth/summary');
  if (!can) return <NoAccess />;
  const s = summary.data;
  const cmpLabel = compare === 'none' ? undefined : compare === 'yoy' ? 'vs last year' : 'vs previous';
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Key numbers" className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MetricTile kpi={s?.signups} compareLabel={cmpLabel} />
        <MetricTile kpi={s?.dau} compareLabel={cmpLabel} />
        <BigNumber
          label="Activation"
          tip="Share of new users in this period who bought within 7 days of signing up."
          value={s ? fmt('ratio', s.firstPurchase7d) : '…'}
          sub={s ? `Bought within 7 days · MAU ${fmt('count', s.mau)}` : undefined}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ActiveUsers />
        <Signups compareLabel={COMPARE_LABELS[compare]} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Funnel />
        <SignupSources />
      </div>

      <details className="group rounded-panel bg-canvas">
        <summary className="display flex h-14 cursor-pointer list-none items-center justify-between px-6 text-[16px] text-ink">
          More charts
          <span className="text-[13px] text-ink-muted group-open:hidden">Lifecycle, retention, countries</span>
        </summary>
        <div className="flex flex-col gap-5 px-0 pb-0">
          <Lifecycle />
          <Retention />
          <AccessCountries />
        </div>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ signup sources (moved from Overview) */
function SignupSources() {
  const br = useAnalytics<{ channels: { channel: string; count: number }[]; signupMethods: { method: string; count: number }[] }>('/overview/breakdowns');
  return (
    <QueryPanel title="Signups by source" query={br} skeleton="list" info="Paid sign-ups include cash and POS sales organizers record themselves; those aren't part of GMV.">
      {(d) => (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-[13px] font-medium text-ink">Account method</h3>
            <BarList rows={d.signupMethods.map((x) => ({ label: x.method === 'MANUAL' ? 'Email' : humanize(x.method), value: x.count }))} unit="count" empty="No new accounts." />
          </div>
          <div>
            <h3 className="mb-3 text-[13px] font-medium text-ink">Paid sign-up channel</h3>
            <BarList rows={d.channels.map((c) => ({ label: humanize(c.channel), value: c.count }))} unit="count" empty="No paid sign-ups." />
          </div>
        </div>
      )}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ access countries */
interface Countries {
  activeUsers: { country: string; name: string; users: number }[];
  requests: { country: string; name: string; requests: number; signedIn: number; fromEdge: number }[];
  visitors: { country: string; name: string; visitorDays: number; avgDaily: number }[];
  newUserHome: { country: string; name: string; users: number }[];
  coverage: { active: number; gps: number; network: number; sim: number; device: number; vpn: number; roaming: number };
}

function AccessCountries() {
  const q = useAnalytics<Countries>('/growth/countries');
  return (
    <QueryPanel
      title="Where people use Sinc from"
      info="Per user: GPS when shared in the last 7 days, otherwise the network country. Raw IP addresses are never stored."
      query={q}
      skeleton="list"
    >
      {(d) => {
        const located = d.activeUsers.filter((r) => r.country !== 'XX').reduce((a, r) => a + r.users, 0);
        const total = d.activeUsers.reduce((a, r) => a + r.users, 0);
        const cov = d.coverage;
        const pct = (n: number) => (cov.active ? fmt('ratio', n / cov.active) : 'No data');
        return (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div>
                <h3 className="text-[13px] font-medium text-ink">Active users by access country</h3>
                <p className="mb-3 text-[12px] text-ink-muted">
                  {fmt('count', located)} of {fmt('count', total)} located
                </p>
                <BarList rows={d.activeUsers.map((r) => ({ label: r.name, sub: r.country !== 'XX' ? r.country : undefined, value: r.users }))} unit="count" empty="No active users in this period." />
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink">
                  Daily visitors by network country <InfoTip label="About daily visitors">Signed in or not, counted once per day by a keyed hash.</InfoTip>
                </h3>
                <BarList rows={d.visitors.map((r) => ({ label: r.name, sub: r.country !== 'XX' ? r.country : undefined, value: r.visitorDays }))} unit="count" empty="No visitor data yet." />
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink">
                  New users by home country <InfoTip label="About home country">From the SIM network, else the phone number.</InfoTip>
                </h3>
                <BarList rows={d.newUserHome.map((r) => ({ label: r.name, sub: r.country !== 'XX' ? r.country : undefined, value: r.users }))} unit="count" empty="No signups in this period." />
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[13px] font-medium text-ink">Signal coverage for active users</h3>
              <Facts
                cols={6}
                items={[
                  { label: 'GPS (last 7 days)', value: pct(cov.gps), hint: 'Users who share location in the app' },
                  { label: 'Network country', value: pct(cov.network), hint: 'Edge header or IP lookup' },
                  { label: 'SIM country', value: pct(cov.sim), hint: 'Sent by the app as X-Sinc-Sim-Country' },
                  { label: 'Device time zone', value: pct(cov.device), hint: 'Sent by the app as X-Sinc-Timezone' },
                  { label: 'Likely VPN or proxy', value: fmt('count', cov.vpn), hint: 'Network country differs from GPS' },
                  { label: 'Roaming', value: fmt('count', cov.roaming), hint: 'SIM country differs from where they connect' },
                ]}
              />
            </div>
            {d.requests.length > 0 && (
              <details>
                <summary className="cursor-pointer text-[13px] font-medium text-ink underline decoration-ember underline-offset-4">Requests by network country</summary>
                <div className="relative mt-3 max-w-[640px] overflow-x-auto">
                <table className="w-full min-w-[480px] text-[13px]">
                  <thead className="bg-fog text-left text-[12px] text-ink-secondary">
                    <tr>
                      <th className="h-9 px-3 font-medium">Country</th>
                      <th className="px-3 text-right font-medium">Requests</th>
                      <th className="px-3 text-right font-medium">Signed in</th>
                      <th className="px-3 text-right font-medium">From edge header</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.requests.map((r) => (
                      <tr key={r.country} className="border-b border-line">
                        <td className="h-9 px-3">
                          <CountryCode code={r.country} name={r.name} />
                        </td>
                        <td className="num px-3 text-right">{fmt('count', r.requests)}</td>
                        <td className="num px-3 text-right">{fmt('count', r.signedIn)}</td>
                        <td className="num px-3 text-right">{fmt('count', r.fromEdge)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </details>
            )}
          </div>
        );
      }}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ active users */
function ActiveUsers() {
  const q = useAnalytics<{ points: { day: string; dau: number; wau: number; mau: number }[]; trackingStart: string | null }>('/growth/active');
  return (
    <QueryPanel title="Active users" query={q} info={tracked(q.data?.trackingStart)}>
      {(d) => (
        <div className="h-[280px]" role="img" aria-label={`Daily, weekly and monthly active users from ${shortDay(d.points[0]?.day ?? '')}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.line} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={{ border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 }} labelFormatter={(l) => shortDay(String(l))} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line name="Monthly" dataKey="mau" stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name="Weekly" dataKey="wau" stroke={C.brass} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line name="Daily" dataKey="dau" stroke={C.emberData} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ signups */
function Signups({ compareLabel }: { compareLabel: string }) {
  const q = useAnalytics<{ series: Series; byMethod: { method: string; count: number }[]; byType: { type: string; count: number }[] }>('/growth/signups');
  return (
    <QueryPanel title="Signups" query={q}>
      {(d) => (
        <>
          <TrendChart series={d.series} compareLabel={compareLabel} height={200} />
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-ink">By sign-in method</h3>
              <BarList rows={d.byMethod.map((m) => ({ label: m.method === 'MANUAL' ? 'Email and password' : humanize(m.method), value: m.count }))} unit="count" empty="No signups." />
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-ink">By account type</h3>
              <BarList rows={d.byType.map((m) => ({ label: humanize(m.type), value: m.count }))} unit="count" empty="No signups." />
            </div>
          </div>
        </>
      )}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ lifecycle */
function Lifecycle() {
  const q = useAnalytics<{ weeks: { week: string; new: number; returning: number; resurrected: number; dormant: number; partial: boolean }[]; trackingStart: string | null }>('/growth/lifecycle');
  return (
    <QueryPanel title="Weekly user lifecycle" query={q} freshness={`New, returning and resurrected users each week; dormant users shown below the line. ${tracked(q.data?.trackingStart)}`}>
      {(d) => {
        const data = d.weeks.map((w) => ({ ...w, dormantNeg: -w.dormant }));
        return (
          <div className="h-[280px]" role="img" aria-label="Weekly new, returning, resurrected and dormant users">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.line} />
                <XAxis dataKey="week" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => String(Math.abs(v))} />
                <Tooltip
                  contentStyle={{ border: '1px solid var(--line-strong)', borderRadius: 0, fontSize: 12 }}
                  labelFormatter={(l) => `Week of ${shortDay(String(l))}`}
                  formatter={(v, n) => [Math.abs(Number(v)).toLocaleString('en'), n]}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Bar name="New" dataKey="new" stackId="a" fill={C.emberData} isAnimationActive={false} />
                <Bar name="Returning" dataKey="returning" stackId="a" fill={C.ink} isAnimationActive={false} />
                <Bar name="Resurrected" dataKey="resurrected" stackId="a" fill={C.brass} isAnimationActive={false} />
                <Bar name="Dormant" dataKey="dormantNeg" stackId="a" fill={C.inkDisabled} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ retention heatmap */
const SEQ = ['var(--seq-0)', 'var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)'];
const bucket = (rate: number) => (rate <= 0 ? 0 : rate < 0.05 ? 1 : rate < 0.1 ? 2 : rate < 0.2 ? 3 : rate < 0.35 ? 4 : rate < 0.5 ? 5 : 6);
const monthLabel = (ym: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`));

function Retention() {
  const q = useAnalytics<{ trackingStart: string | null; cohorts: { cohort: string; size: number; cells: { m: number; rate: number | null; active: number; beforeTracking: boolean }[] }[] }>('/growth/retention');
  return (
    <QueryPanel title="Retention by cohort" query={q} skeleton="table" freshness={`Share of each signup month active in later months. Grey cells fall before activity tracking began. ${tracked(q.data?.trackingStart)}`}>
      {(d) => {
        const maxM = Math.max(0, ...d.cohorts.map((c) => c.cells.length - 1));
        return (
          <div className="relative -mx-4 sm:-mx-6 overflow-x-auto px-4 sm:px-6">
            <table className="w-full min-w-[720px] border-separate border-spacing-[2px] text-[12px]">
              <thead>
                <tr className="text-left text-ink-secondary">
                  <th scope="col" className="h-8 pr-3 font-medium">Cohort</th>
                  <th scope="col" className="pr-3 text-right font-medium">Users</th>
                  {Array.from({ length: maxM + 1 }).map((_, m) => (
                    <th key={m} scope="col" className="w-14 text-center font-medium">
                      M{m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.cohorts.map((c) => (
                  <tr key={c.cohort}>
                    <th scope="row" className="h-9 whitespace-nowrap pr-3 text-left font-normal text-ink">
                      {monthLabel(c.cohort)}
                    </th>
                    <td className="num pr-3 text-right text-ink-secondary">{c.size.toLocaleString('en')}</td>
                    {Array.from({ length: maxM + 1 }).map((_, m) => {
                      const cell = c.cells[m];
                      if (!cell) return <td key={m} />;
                      if (cell.beforeTracking || cell.rate === null)
                        return (
                          <td key={m} className="bg-fog text-center text-ink-muted" title="Before activity tracking began">
                            –
                          </td>
                        );
                      const b = bucket(cell.rate);
                      return (
                        <td
                          key={m}
                          className="num text-center"
                          style={{ background: SEQ[b], color: b >= 4 ? 'var(--seq-text-strong)' : 'var(--seq-text)' }}
                          title={`${cell.active.toLocaleString('en')} of ${c.size.toLocaleString('en')} active`}
                        >
                          {(cell.rate * 100).toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </QueryPanel>
  );
}

/* ------------------------------------------------------------------ funnel */
function Funnel() {
  const q = useAnalytics<{ hasData: boolean; windowMinutes?: number; steps: { key: string; label: string; count: number }[] }>('/growth/funnel');
  return (
    <QueryPanel title="Purchase funnel" query={q} skeleton="list" freshness={q.data?.hasData ? `Each step within ${q.data.windowMinutes} minutes of the previous one, per person and event. "Paid" is confirmed against payments.` : undefined}>
      {(d) =>
        !d.hasData ? (
          <InlineEmpty>
            No product events in this period.{' '}
            <InfoTip label="Setup">Setup: the apps need to send event_viewed, ticket_selected, checkout_started and payment_initiated to /track.</InfoTip>
          </InlineEmpty>
        ) : (
          <ol className="flex flex-col gap-4">
            {d.steps.map((s, i) => {
              const first = d.steps[0].count || 1;
              const prev = i ? d.steps[i - 1].count : null;
              return (
                <li key={s.key}>
                  <div className="flex items-baseline justify-between gap-4 text-[13px]">
                    <span className="text-ink">{s.label}</span>
                    <span className="num text-ink">
                      {s.count.toLocaleString('en')}
                      {prev !== null && <span className="ml-2 text-[12px] text-ink-muted">{prev ? fmt('ratio', s.count / prev) : 'No data'} of previous</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full" aria-hidden>
                    <div className="h-full" style={{ width: `${Math.max(1, (s.count / first) * 100)}%`, background: i === d.steps.length - 1 ? C.emberData : C.ink }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )
      }
    </QueryPanel>
  );
}
