'use client';

import { PagerBar, useCursorPager } from '@/components/pager';
import { AppLink } from '@/components/AppLink';
import { parseAsString, useQueryStates } from 'nuqs';
import { NoAccess } from '@/components/PhasePlaceholder';
import { TxStatus } from '@/components/TxStatus';
import { fmt, humanize } from '@/components/analytics-ui';
import { EmptyState, ErrorState, Panel, Skeleton } from '@/components/ui';
import { chipsFor, FilterBar, SearchForm, SelectField, OpenCell, openRow } from '@/components/directory-ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useProviders } from '@/lib/providers';
import { useCan } from '../me-context';

interface Tx {
  id: number;
  createdAt: string;
  amount: number;
  currency: string;
  status: string;
  transactionType: string;
  paymentGateway: string | null;
  correspondent: string | null;
  flow: string | null;
  country: string;
  organizer: string | null;
  errorMessage: string | null;
}

const TYPES = ['TICKET_PAYMENT', 'PRODUCT_PAYMENT', 'GROUP_MEMBERSHIP', 'COMMISSION_COLLECTION', 'WITHDRAW', 'REVERSE_PAYMENT', 'PLAN_PAYMENT', 'MESSAGE_PAYMENT', 'EVENT_POST_PAYMENT', 'AFFILIATION', 'COLLABORATION', 'PARTNER_SHARE'];
const NETWORKS = ['MTN_MOMO_RWA', 'AIRTEL_RWA', 'MTN_MOMO_UGA', 'AIRTEL_OAPI_UGA', 'CARD', 'CASH', 'POS', 'SINC'];

export default function TransactionsPage() {
  const can = useCan('money.read');
  const providers = useProviders();
  const { params } = useScopeParams();
  const [f, setF] = useQueryStates({
    status: parseAsString,
    type: parseAsString,
    gateway: parseAsString,
    correspondent: parseAsString,
    flow: parseAsString,
    q: parseAsString,
  });

  const txParams = new URLSearchParams(params);
  Object.entries(f).forEach(([k, v]) => v && txParams.set(k, v));
  const q = useCursorPager<Tx>('/transactions', txParams, { enabled: can });

  if (!can) return <NoAccess />;
  const items = q.items;
  // Providers are discovered by the admin service (known, priced, or seen in payments), plus Sinc's own channels.
  const gateways = [...(providers.data?.providers.map((p) => p.code) ?? []), 'MANUAL', 'SINC'];
  const opts = (xs: string[]) => xs.map((o) => ({ value: o, label: humanize(o) }));
  const defs = [
    { key: 'status', label: 'Status', options: [{ value: 'SUCCESS', label: 'Successful' }, { value: 'FAILED', label: 'Failed' }, { value: 'PENDING', label: 'Pending' }] },
    { key: 'type', label: 'Type', options: opts(TYPES) },
    { key: 'correspondent', label: 'Network', options: opts(NETWORKS) },
    { key: 'gateway', label: 'Provider', options: opts(gateways) },
    { key: 'flow', label: 'Direction', options: [{ value: 'INCOMING', label: 'Incoming' }, { value: 'OUTGOING', label: 'Outgoing' }] },
  ];
  const fv = f as Record<string, string | null>;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        search={<SearchForm id="f-q" label="Find a transaction" placeholder="Id, tx_ref or provider id" helper="Exact match. Ignores the date range." initial={f.q ?? ''} onSearch={(v) => setF({ q: v })} />}
        filters={defs.map((d) => (
          <SelectField key={d.key} id={`f-${d.key}`} label={d.label} value={fv[d.key]} onChange={(v) => setF({ [d.key]: v })} options={d.options} />
        ))}
        active={chipsFor(defs, fv, (k) => setF({ [k]: null }))}
        onClearAll={() => setF({ status: null, type: null, correspondent: null, gateway: null, flow: null })}
      />

      <Panel title="Transactions" freshness="Newest first" busy={q.isFetching && !!q.isPlaceholderData}>
        {q.isLoading ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : q.error && !items.length ? (
          <ErrorState what="transactions" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="No transactions match" body="Widen the dates or clear a filter." />
        ) : (
          <div className={`relative -mx-6 max-h-[min(70dvh,900px)] overflow-auto transition-opacity ${q.isFetching && q.isPlaceholderData ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[980px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-fog text-left text-[12px] text-ink-secondary">
                  <th scope="col" className="h-10 px-6 font-medium">Id</th>
                  <th scope="col" className="px-4 font-medium">When</th>
                  <th scope="col" className="px-4 font-medium">Type</th>
                  <th scope="col" className="px-4 font-medium">Organizer</th>
                  <th scope="col" className="px-4 font-medium">Network</th>
                  <th scope="col" className="px-4 font-medium">Status</th>
                  <th scope="col" className="px-4 text-right font-medium">Amount</th>
                  <th scope="col" className="px-6"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody onClick={openRow}>
                {items.map((t) => (
                  <tr key={t.id} className="h-11 border-b border-line hover:bg-fog">
                    <td className="num px-6">
                      <AppLink rowLink href={`/transactions/${t.id}`} className="text-ink underline decoration-ember underline-offset-4 hover:decoration-2">
                        {t.id}
                      </AppLink>
                    </td>
                    <td className="num whitespace-nowrap px-4 text-ink-secondary">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 text-ink">
                      {humanize(t.transactionType)}
                      {t.flow === 'OUTGOING' && <span className="ml-1.5 text-[12px] text-ink-muted">out</span>}
                    </td>
                    <td className="max-w-[200px] truncate px-4 text-ink-secondary">{t.organizer ?? 'None'}</td>
                    <td className="px-4 text-ink-secondary">{humanize(t.correspondent)}</td>
                    <td className="px-4" title={t.errorMessage ?? undefined}>
                      <TxStatus status={t.status} />
                    </td>
                    <td className="num px-4 text-right text-ink">{fmt('money', t.amount, t.currency)}</td>
                    <OpenCell href={`/transactions/${t.id}`} name={`transaction ${t.id}`} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PagerBar pager={q} noun="transactions" />
      </Panel>
    </div>
  );
}
