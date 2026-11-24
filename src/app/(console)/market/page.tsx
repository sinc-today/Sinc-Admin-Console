'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { AppLink } from '@/components/AppLink';
import { BarList, QueryPanel, TrendChart, fmt } from '@/components/analytics-ui';
import { BigNumber } from '@/components/directory-ui';
import { NoAccess } from '@/components/PhasePlaceholder';
import { Delta, ErrorState, InlineEmpty } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../me-context';

interface Kpi {
  value: number;
  previous: number | null;
  deltaPct: number | null;
  unit: 'money' | 'count' | 'ratio';
}
interface Overview {
  country: string;
  currency: string;
  from: string;
  to: string;
  kpis: { gmv: Kpi; payments: Kpi; successRate: Kpi; tickets: Kpi; newOrganizers: Kpi };
  organizers: { total: number; verified: number; pending: number };
  events: { live: number; upcoming: number; inPeriod: number };
  gmvPerDay: { t: string; v: number }[];
  topEvents: { id: number; name: string; sold: number }[];
  topOrganizers: { id: number; name: string; sold: number }[];
  pendingVerification: { id: number; name: string; since: string }[];
}

const COUNTRY: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda' };

/** The partner's market at a glance: sales, organizers and events in their countries. */
export default function MarketPage() {
  const can = useCan('market.read');
  const canVerify = useCan('market.organizers.verify');
  const sp = useSearchParams();
  const partnerId = sp.get('partnerId');
  const { params, key } = useScopeParams();
  const me = useQuery({ queryKey: ['market-me', partnerId], queryFn: () => api<{ partnerName: string; countries: string[]; asPartner: boolean }>(`/market/me${partnerId ? `?partnerId=${partnerId}` : ''}`), enabled: can });
  const qs = new URLSearchParams(params);
  if (partnerId) qs.set('partnerId', partnerId);
  const q = useQuery({ queryKey: ['market-overview', key, partnerId], queryFn: () => api<Overview>(`/market/overview?${qs}`), enabled: can });
  if (!can) return <NoAccess />;
  const d = q.data;
  const cur = d?.currency ?? 'RWF';
  const kpi = (label: string, k: Kpi | undefined, tip: string, polarity: 'up_is_good' = 'up_is_good') => (
    <BigNumber
      label={label}
      tip={tip}
      value={k ? (k.unit === 'money' ? fmt('money', k.value, cur, true) : k.unit === 'ratio' ? fmt('ratio', k.value) : fmt('count', k.value)) : '…'}
      sub={k && k.deltaPct !== null ? <Delta value={k.deltaPct} polarity={polarity} /> : k ? 'No comparison' : undefined}
    />
  );
  const keep = partnerId ? `?partnerId=${partnerId}` : '';

  return (
    <div className="flex flex-col gap-5">
      {me.data && (
        <p className="display text-[20px] leading-snug text-ink">
          {me.data.partnerName} · {me.data.countries.map((c) => COUNTRY[c] ?? c).join(', ')}
          {!me.data.asPartner && <span className="ml-2 text-[14px] text-ink-muted">(preview as partner)</span>}
        </p>
      )}

      {q.error && !d ? (
        <ErrorState what="your market" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : (
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-5">
          {kpi('GMV', d?.kpis.gmv, 'Everything buyers paid for tickets and products in your country, through a payment provider.')}
          {kpi('Tickets sold', d?.kpis.tickets, 'Tickets issued for events in your country.')}
          {kpi('Payments', d?.kpis.payments, 'Successful ticket and product payments.')}
          {kpi('Payment success', d?.kpis.successRate, 'Successful ÷ (successful + failed) payments.')}
          {kpi('New organizers', d?.kpis.newOrganizers, 'Organizer profiles created in your country in this period.')}
        </section>
      )}

      <QueryPanel title="GMV per day" query={q} info="Successful payments in your country, in local time.">
        {(x) => <TrendChart series={{ key: 'gmv', label: 'GMV', unit: 'money', currency: x.currency, definition: '', points: x.gmvPerDay.map((p) => ({ ...p, cmpT: null, cmpV: null })) }} height={260} />}
      </QueryPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <QueryPanel title="Organizers" query={q} skeleton="list" actions={<AppLink href="/organizers" className="text-[13px] underline decoration-ember underline-offset-4">See all</AppLink>}>
          {(x) => (
            <dl className="grid grid-cols-3 gap-4">
              <Stat label="Total" value={fmt('count', x.organizers.total)} />
              <Stat label="Verified" value={fmt('count', x.organizers.verified)} />
              <Stat label="Waiting" value={fmt('count', x.organizers.pending)} highlight={x.organizers.pending > 0} />
            </dl>
          )}
        </QueryPanel>
        <QueryPanel title="Events" query={q} skeleton="list" actions={<AppLink href="/events" className="text-[13px] underline decoration-ember underline-offset-4">See all</AppLink>}>
          {(x) => (
            <dl className="grid grid-cols-3 gap-4">
              <Stat label="Live now" value={fmt('count', x.events.live)} />
              <Stat label="Upcoming" value={fmt('count', x.events.upcoming)} />
              <Stat label="In period" value={fmt('count', x.events.inPeriod)} />
            </dl>
          )}
        </QueryPanel>
        <QueryPanel title="Waiting for verification" query={q} skeleton="list" info="Oldest first. Open an organizer to verify or decline.">
          {(x) =>
            x.pendingVerification.length === 0 ? (
              <InlineEmpty>Nobody is waiting.</InlineEmpty>
            ) : (
              <ul className="hover-list flex flex-col">
                {x.pendingVerification.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px]">
                    <span className="truncate text-ink">{p.name}</span>
                    <AppLink href={`/organizers/${p.id}`} className="shrink-0 text-ink underline decoration-ember underline-offset-4">
                      {canVerify ? 'Review' : 'Open'}
                    </AppLink>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Top events" query={q} skeleton="list" info="By tickets sold in this period.">
          {(x) => <BarList rows={x.topEvents.map((e) => ({ label: e.name, value: e.sold, href: `/market/events/${e.id}${keep}` }))} unit="count" empty="No tickets sold in this period." />}
        </QueryPanel>
        <QueryPanel title="Top organizers" query={q} skeleton="list" info="By tickets sold in this period.">
          {(x) => <BarList rows={x.topOrganizers.map((o) => ({ label: o.name, value: o.sold, href: `/market/organizers/${o.id}${keep}` }))} unit="count" empty="No tickets sold in this period." />}
        </QueryPanel>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-ink-secondary">{label}</dt>
      <dd className={`display num mt-1 text-[28px] leading-tight ${highlight ? 'text-ember-ink' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}
