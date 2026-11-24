'use client';

import Link from 'next/link';
import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, MetricTile, QueryPanel, TrendChart, fmt } from '@/components/analytics-ui';
import { ErrorState, StatusBadge } from '@/components/ui';
import { freshnessLabel, useAnalytics, useScopeParams, type Freshness, type Kpi, type Series } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { COMPARE_LABELS } from '@/lib/scope';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCan, useMe } from './me-context';

interface Breakdowns {
  topEvents: { items: { id: number; name: string; amount: number; count: number }[]; unlinkedAmount: number };
  topOrganizers: { id: number | null; name: string; amount: number; count: number }[];
  channels: { channel: string; count: number; amount: number }[];
  correspondents: { correspondent: string; amount: number; count: number }[];
  signupMethods: { method: string; count: number }[];
}

const KPI_LINKS: Record<string, string> = {
  gmv: '/money?tab=collections',
  commission: '/money?tab=revenue',
  success_rate: '/money?tab=collections',
  tickets_sold: '/transactions?type=TICKET_PAYMENT',
};

export default function OverviewPage() {
  const me = useMe();
  const router = useRouter();
  useEffect(() => {
    if (me.staff.partnerId) router.replace('/market');
  }, [me.staff.partnerId, router]);
  const can = useCan('analytics.read');
  const canMoney = useCan('money.read');
  const { currency, compare } = useScopeParams();
  const kpis = useAnalytics<{ kpis: Kpi[]; freshness: Freshness }>('/overview/kpis', {}, { enabled: can });
  const gmv = useAnalytics<{ series: Series; freshness: Freshness }>('/overview/series', { metric: 'gmv' }, { enabled: can });
  const br = useAnalytics<Breakdowns>('/overview/breakdowns', {}, { enabled: can });
  const attention = useAnalytics<{ items: { key: string; label: string; count: number; href: string; status: 'critical' | 'warning' }[] }>(
    '/overview/attention',
    {},
    { enabled: can, refetchMs: 60_000 }
  );

  if (!can) return <NoAccess />;
  const cmpLabel = compare === 'none' ? undefined : compare === 'yoy' ? 'vs last year' : 'vs previous';

  const gmvKpi = kpis.data?.kpis.find((k) => k.key === 'gmv');

  return (
    <div className="flex flex-col gap-5">
      {gmvKpi && <Verdict kpi={gmvKpi} currency={currency} cmpLabel={cmpLabel} />}

      {attention.data && attention.data.items.length > 0 && (
        <section aria-label="Needs attention" className="flex flex-wrap items-center gap-2">
          {attention.data.items.map((i) => (
            <Link key={i.key} href={i.href} className="group inline-flex h-9 items-center gap-2 rounded-pill bg-canvas pl-1.5 pr-3 hover:bg-fog">
              <StatusBadge status={i.status}>
                <span className="num">{i.count}</span>
              </StatusBadge>
              <span className="text-[13px] text-ink">{i.label}</span>
            </Link>
          ))}
        </section>
      )}

      {kpis.error && !kpis.data ? (
        <ErrorState what="key numbers" message={(kpis.error as Error).message} requestId={(kpis.error as ApiError).requestId} onRetry={() => kpis.refetch()} />
      ) : (
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3 2xl:grid-cols-6">
          {(kpis.data?.kpis ?? Array.from({ length: 6 }).map(() => undefined)).slice(0, 6).map((k, i) => (
            <MetricTile key={k?.key ?? i} kpi={k} compareLabel={cmpLabel} href={k && canMoney ? KPI_LINKS[k.key] : undefined} />
          ))}
        </section>
      )}

      <QueryPanel title="GMV per day" freshness={freshnessLabel(gmv.data?.freshness)} query={gmv}>
        {(d) => <TrendChart series={d.series} compareLabel={COMPARE_LABELS[compare]} height={280} />}
      </QueryPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Top events" query={br} skeleton="list" actions={<SeeAll href="/events?sort=processed" />}>
          {(d) => (
            <BarList
              rows={d.topEvents.items.slice(0, 5).map((e) => ({ label: e.name, value: e.amount, sub: `${e.count.toLocaleString('en')} payments` }))}
              unit="money"
              currency={currency}
              empty="No ticket sales in this period."
            />
          )}
        </QueryPanel>
        <QueryPanel title="Top organizers" query={br} skeleton="list" actions={<SeeAll href="/organizers" />}>
          {(d) => (
            <BarList
              rows={d.topOrganizers.slice(0, 5).map((o) => ({ label: o.name, value: o.amount, sub: `${o.count.toLocaleString('en')} payments` }))}
              unit="money"
              currency={currency}
              empty="No payments in this period."
            />
          )}
        </QueryPanel>
      </div>
    </div>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link href={href} className="text-[13px] text-ink underline decoration-ember underline-offset-4">
      See all
    </Link>
  );
}

/** One line that answers "how are we doing?" for the period. */
function Verdict({ kpi, currency, cmpLabel }: { kpi: Kpi; currency: string; cmpLabel?: string }) {
  const d = kpi.compare?.deltaPct;
  const value = fmt('money', kpi.value, currency, true);
  return (
    <p className="display text-[20px] leading-snug text-ink" aria-live="polite">
      GMV {value}
      {d !== null && d !== undefined && cmpLabel && (
        <span className="text-ink-secondary">
          , {d >= 0 ? 'up' : 'down'} {Math.abs(d * 100).toFixed(0)}% {cmpLabel.replace(/^vs /, 'vs ')}
        </span>
      )}
    </p>
  );
}
