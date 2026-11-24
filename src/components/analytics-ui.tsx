'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Kpi, Series, Unit } from '@/lib/analytics';
import { C, axisTick } from '@/lib/chart-theme';
import { formatCount, formatMoney, formatPercent, type Currency } from '@/lib/format';
import { Delta, ErrorState, InfoTip, Panel, Skeleton, SlowNote } from './ui';
import { ApiError } from '@/lib/api';

/* ------------------------------------------------------------------ formatting */
export const fmt = (unit: Unit, v: number | null | undefined, currency?: string, compact = false) => {
  if (v === null || v === undefined || Number.isNaN(v)) return 'No data';
  if (unit === 'money') return formatMoney(v, (currency as Currency) || 'RWF', { compact });
  if (unit === 'ratio') return formatPercent(v, 1);
  return formatCount(Math.round(v * 10) / 10, { compact });
};

const shortDay = (d: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

/* ------------------------------------------------------------------ Sparkline (no axes, Graphite 1.5px, last point marked) */
export function Sparkline({ points, label }: { points: { v: number | null }[]; label: string }) {
  const w = 220;
  const h = 32;
  const vals = points.map((p) => p.v);
  const nums = vals.filter((v): v is number => v !== null);
  if (nums.length < 2) return <div className="h-8" aria-hidden />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const x = (i: number) => (i / (vals.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  let d = '';
  vals.forEach((v, i) => {
    if (v === null) return;
    d += `${d === '' || vals[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const lastIdx = vals.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop()!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-8 w-full" role="img" aria-label={`${label} trend`}>
      <path d={d} fill="none" stroke={C.ink} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={x(lastIdx)} cy={y(vals[lastIdx]!)} r={2.5} fill={C.ink} />
    </svg>
  );
}

/* ------------------------------------------------------------------ KPI tile driven by API data */
export function MetricTile({ kpi, compareLabel, href }: { kpi?: Kpi; compareLabel?: string; href?: string }) {
  if (!kpi) {
    return (
      <div className="flex min-h-[132px] flex-col rounded-panel bg-canvas p-4 sm:min-h-[148px] sm:p-5" role="status" aria-label="Loading">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-36" />
        <Skeleton className="mt-3 h-3 w-28" />
        <Skeleton className="mt-4 h-8 w-full" />
      </div>
    );
  }
  const delta = kpi.compare?.deltaPct;
  // Fewer than half the days have data: show the change in grey, not as good or bad.
  const known = kpi.sparkline.filter((p) => p.v !== null).length;
  const partial = kpi.sparkline.length > 2 && known < kpi.sparkline.length / 2;
  const polarity = partial ? 'neutral' : kpi.polarity;
  const cls = 'relative flex min-h-[132px] flex-col rounded-panel bg-canvas p-4 sm:min-h-[148px] sm:p-5';
  return (
    <div className={clsx(cls, href && 'card-link cursor-pointer hover:bg-fog')}>
      {href && <Link href={href} aria-label={`${kpi.label}: open details`} className="absolute inset-0 rounded-panel" />}
      <p className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
        {kpi.label}
        {kpi.definition && (
          <span className="relative z-10">
            <InfoTip label={`About ${kpi.label}`}>{kpi.definition}</InfoTip>
          </span>
        )}
      </p>
      <p className="display num mt-2 truncate text-[24px] leading-[1.19] text-ink sm:text-[32px]" title={fmt(kpi.unit, kpi.value, kpi.currency)}>
        {fmt(kpi.unit, kpi.value, kpi.currency, kpi.unit === 'money')}
      </p>
      <div className="mt-1 flex min-h-[18px] flex-wrap items-baseline gap-x-2 text-[12px] text-ink-muted">
        {delta !== null && delta !== undefined ? (
          kpi.unit === 'ratio' ? <RatioDelta value={delta} polarity={polarity} /> : <Delta value={delta} polarity={polarity} />
        ) : kpi.compare ? (
          <span>No comparison</span>
        ) : null}
        {kpi.compare && kpi.compare.value !== null && (
          <span className="num" title={`${compareLabel ?? 'vs'} ${fmt(kpi.unit, kpi.compare.value, kpi.currency)}`}>
            {compareLabel ?? 'vs'} {fmt(kpi.unit, kpi.compare.value, kpi.currency, true)}
          </span>
        )}
        {partial && (
          <span className="relative z-10">
            <InfoTip label="Partial period">Partial period: fewer than half the days have data, so the change may mislead.</InfoTip>
          </span>
        )}
      </div>
      <Sparkline points={kpi.sparkline} label={kpi.label} />
    </div>
  );
}

/** Ratio deltas are shown in percentage points, not relative %. */
function RatioDelta({ value, polarity }: { value: number; polarity: Kpi['polarity'] }) {
  const up = value >= 0;
  const bad = (polarity === 'up_is_good' && !up) || (polarity === 'up_is_bad' && up);
  return (
    <span className={clsx('num text-[12px] font-medium', bad ? 'text-ember-ink' : 'text-ink')}>
      <span aria-hidden>{up ? '▲' : '▼'}</span> {Math.abs(value * 100).toFixed(1)} pt<span className="sr-only">{up ? ' increase' : ' decrease'}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ Trend chart: current vs compare (dashed) */
export function TrendChart({ series, height = 320, compareLabel = 'Previous period' }: { series: Series; height?: number; compareLabel?: string }) {
  const [asTable, setAsTable] = useState(false);
  const data = series.points;
  const hasCmp = data.some((p) => p.cmpV !== null);
  const total = data.reduce((a, p) => a + (p.v ?? 0), 0);
  const summary = `${series.label} per day from ${shortDay(data[0]?.t)} to ${shortDay(data[data.length - 1]?.t)}${series.unit !== 'ratio' ? `, total ${fmt(series.unit, total, series.currency)}` : ''}.`;
  const tickFmt = (v: number) => (series.unit === 'ratio' ? `${Math.round(v * 100)}%` : fmt(series.unit, v, series.currency, true).replace(/^(RWF|UGX)\s/, ''));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 text-[12px] text-ink-secondary">
          <span className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-5 bg-ink" /> This period
          </span>
          {hasCmp && (
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-block w-5 border-t border-dashed border-ink-disabled" /> {compareLabel}
            </span>
          )}
          {series.unit === 'money' && <span className="text-ink-muted">{series.currency}</span>}
        </div>
        <button type="button" onClick={() => setAsTable((x) => !x)} className="text-[12px] font-medium text-ink underline decoration-ember underline-offset-4">
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-fog text-left text-[12px] text-ink-secondary">
              <tr>
                <th className="h-9 px-3 font-medium">Day</th>
                <th className="px-3 text-right font-medium">This period</th>
                {hasCmp && <th className="px-3 text-right font-medium">{compareLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.t} className="border-b border-line">
                  <td className="h-9 px-3 text-ink-secondary">{shortDay(p.t)}</td>
                  <td className="num px-3 text-right text-ink">{fmt(series.unit, p.v, series.currency)}</td>
                  {hasCmp && <td className="num px-3 text-right text-ink-secondary">{fmt(series.unit, p.cmpV, series.currency)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={C.line} />
              <XAxis dataKey="t" tickFormatter={shortDay} tick={axisTick} axisLine={false} tickLine={false} minTickGap={32} />
              <YAxis tickFormatter={tickFmt} tick={axisTick} axisLine={false} tickLine={false} width={56} tickCount={5} domain={series.unit === 'ratio' ? ['auto', 'auto'] : [0, 'auto']} />
              <Tooltip
                cursor={{ stroke: C.lineStrong }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as Series['points'][number];
                  const delta = p.v !== null && p.cmpV ? (p.v - p.cmpV) / Math.abs(p.cmpV) : null;
                  return (
                    <div className="border border-line-strong bg-canvas px-3 py-2 text-[12px]">
                      <p className="font-medium text-ink">{shortDay(p.t)}</p>
                      <p className="num text-ink">{fmt(series.unit, p.v, series.currency)}</p>
                      {p.cmpT && (
                        <p className="num text-ink-muted">
                          {shortDay(p.cmpT)}: {fmt(series.unit, p.cmpV, series.currency)}
                          {delta !== null && series.unit !== 'ratio' && ` (${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%)`}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
              {hasCmp && <Line type="monotone" dataKey="cmpV" stroke={C.inkDisabled} strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />}
              <Line type="monotone" dataKey="v" stroke={C.ink} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="sr-only">{summary}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Mini line (small multiples) */
export function MiniLine({ points, unit, label, highlight }: { points: { t: string; v: number | null }[]; unit: Unit; label: string; highlight?: boolean }) {
  return (
    <div className="h-20" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <YAxis hide domain={unit === 'ratio' ? [0, 1] : ['auto', 'auto']} />
          <XAxis dataKey="t" hide />
          <Line type="monotone" dataKey="v" stroke={highlight ? C.emberData : C.ink} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ Horizontal bar list (rankings) */
export function BarList({
  rows,
  unit,
  currency,
  empty,
  max,
}: {
  rows: { label: string; value: number; sub?: string; href?: string }[];
  unit: Unit;
  currency?: string;
  empty: string;
  max?: number;
}) {
  const top = useMemo(() => max ?? Math.max(1, ...rows.map((r) => r.value)), [rows, max]);
  if (!rows.length) return <p className="py-2 text-[13px] text-ink-muted">{empty}</p>;
  return (
    <ul className="hover-list flex flex-col gap-3">
      {rows.map((r, i) => {
        const label = r.href ? (
          <Link href={r.href} className="truncate text-ink hover:underline hover:decoration-ember hover:underline-offset-4">
            {r.label}
          </Link>
        ) : (
          <span className="truncate text-ink">{r.label}</span>
        );
        return (
          <li key={`${r.label}-${i}`}>
            <div className="flex items-baseline justify-between gap-4 text-[13px]">
              <span className="flex min-w-0 items-baseline gap-2">
                {label}
                {r.sub && <span className="shrink-0 text-[12px] text-ink-muted">{r.sub}</span>}
              </span>
              <span className="num shrink-0 text-ink">{fmt(unit, r.value, currency)}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full" aria-hidden>
              <div className="h-full bg-ink" style={{ width: `${Math.max(1, (r.value / top) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ Query state wrapper for panels */
export function QueryPanel<T>({
  title,
  freshness,
  info,
  note,
  query,
  skeleton = 'chart',
  actions,
  className,
  children,
}: {
  title: string;
  freshness?: string;
  info?: React.ReactNode;
  note?: React.ReactNode;
  query: { data?: T; error: unknown; isLoading: boolean; isFetching?: boolean; isPlaceholderData?: boolean; refetch: () => unknown };
  skeleton?: 'chart' | 'list' | 'table';
  actions?: React.ReactNode;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const loading = query.isLoading && !query.data;
  const refetching = !!query.data && !!query.isFetching && !!query.isPlaceholderData;
  return (
    <Panel title={title} freshness={freshness} info={info} note={note} actions={actions} className={className} busy={refetching}>
      {loading ? (
        <div role="status" aria-label={`Loading ${title}`} className="flex flex-col gap-3">
          {skeleton === 'chart' ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            Array.from({ length: skeleton === 'table' ? 6 : 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
          )}
          <SlowNote active={loading} />
        </div>
      ) : query.error && !query.data ? (
        <ErrorState what={title.toLowerCase()} message={(query.error as Error).message} requestId={(query.error as ApiError).requestId} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className={clsx('transition-opacity duration-150', refetching && 'opacity-60')}>{children(query.data)}</div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ Tabs (URL-driven) */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" aria-label="Sections" className="flex gap-6 overflow-x-auto whitespace-nowrap border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={clsx(
            'display -mb-px h-11 border-b-2 text-[16px] leading-none transition-colors duration-150',
            active === t.key ? 'border-ember text-ink' : 'border-transparent text-ink-secondary hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const humanize = (s: string | null | undefined) =>
  !s
    ? 'Unknown'
    : ({
        MTN_MOMO_RWA: 'MTN MoMo Rwanda',
        AIRTEL_RWA: 'Airtel Money Rwanda',
        MTN_MOMO_UGA: 'MTN MoMo Uganda',
        AIRTEL_OAPI_UGA: 'Airtel Money Uganda',
        CARD: 'Card',
        CASH: 'Cash',
        POS: 'POS',
        SINC: 'Sinc balance',
        MTN_MOBILE_MONEY: 'MTN MoMo API',
        PAWA_PAY: 'pawaPay',
        PARTNER_SHARE: 'Partner share',
        IOTEC_SMS: 'ioTec SMS',
        AFRICA_STALKING: "Africa's Talking",
        URUBUTO_PAY: 'UrubutoPay',
        FLUTTERWAVE: 'Flutterwave',
        IOTEC_PAY: 'ioTec',
        FDI: 'FDI',
        INTOUCH: 'Intouch',
        MANUAL: 'Manual',
        TICKET_PAYMENT: 'Ticket payment',
        PRODUCT_PAYMENT: 'Product payment',
        GROUP_MEMBERSHIP: 'Membership',
        COMMISSION_COLLECTION: 'Commission',
        WITHDRAW: 'Withdrawal',
        REVERSE_PAYMENT: 'Reversal',
        PLAN_PAYMENT: 'Plan payment',
        PLAN_PAYMENT_COLLECTION: 'Plan collection',
        MESSAGE_PAYMENT: 'Message payment',
        EVENT_POST_PAYMENT: 'Event post',
        AFFILIATION: 'Affiliation',
        COLLABORATION: 'Collaboration',
        FUNDRAISING: 'Fundraising',
        GOOGLE: 'Google',
        APPLE: 'Apple',
        MANUAL_SIGNUP: 'Email',
        MOBILE: 'Mobile app',
        Website: 'Website',
        USSD: 'USSD',
        Cash: 'Cash (recorded by organizer)',
        Pos: 'POS (recorded by organizer)',
      } as Record<string, string>)[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
