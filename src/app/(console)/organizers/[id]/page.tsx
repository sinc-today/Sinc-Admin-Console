'use client';

import { Avatar } from '@/components/Avatar';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLink } from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { NoAccess } from '@/components/PhasePlaceholder';
import { TxStatus } from '@/components/TxStatus';
import { WithdrawalsSwitch } from '@/components/WithdrawalsSwitch';
import { VerifyOrganizerButtons } from '@/components/VerifyOrganizer';
import { OrganizerDocumentsPanel } from '@/components/OrganizerDocuments';
import { MiniLine, fmt, humanize } from '@/components/analytics-ui';
import { ExportButton, Facts, RowLink, Table, dayFmt, td, tdFirst, tdLast, verificationBadge, OpenCell } from '@/components/directory-ui';
import { ErrorState, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { PagerBar, useCursorPager } from '@/components/pager';
import { useCan } from '../../me-context';

interface Org360 {
  organizer: { id: number; name: string; username: string | null; logo?: string | null; description: string | null; contactEmail: string | null; contactPhone: string | null; verification: string | null; kycApproved: boolean; isActive: boolean; isPrivate: boolean; country: string | null; currency: string | null; language: string | null; createdAt: string };
  owner: { id: number; name: string | null; username: string; email: string | null; imageUrl?: string | null } | null;
  members: { userId: number | null; name: string | null; email: string | null; isOwner: boolean; isActive: boolean; imageUrl?: string | null }[];
  events: { total: number; upcoming: number; live: number; recent: { id: number; name: string; startDate: string; endDate: string; country: string | null; sold: number; capacity: number }[] };
  money: { currency: string; gmv: number; payments: number; commission: number; takeRate: number | null; failed: number; withdrawn: number; points: { t: string; v: number }[] };
  wallets: { currency: string; provider: string | null; balance: number; status: string | null }[];
  commissionRequests: { id: number; status: string; percentage: number; reason: string | null; createdAt: string }[];
  recentTransactions: { id: number; createdAt: string; amount: number; currency: string; status: string; transactionType: string; correspondent: string | null }[];
}

export default function OrganizerPage() {
  const can = useCan('organizers.read');
  const canFinanceExport = useCan('exports.finance');
  const { id } = useParams<{ id: string }>();
  const { params, key } = useScopeParams();
  const q = useQuery({ queryKey: ['organizer', id, key], queryFn: () => api<Org360>(`/organizers/${id}?${params}`), enabled: can, placeholderData: (p) => p });
  if (!can) return <NoAccess />;
  if (q.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const o = d.organizer;
  const m = d.money;
  const txParams = new URLSearchParams(params);
  txParams.set('organizerProfileId', String(o.id));
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-secondary">
        <AppLink href="/organizers" className="hover:underline">
          Organizers
        </AppLink>{' '}
        / <span className="text-ink">#{o.id}</span>
      </nav>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
          <Avatar src={o.logo} name={o.name} size={64} square />
          <div className="min-w-0">
            <h2 className="display text-[32px] leading-tight text-ink">{o.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {o.username && `@${o.username} · `}
              {o.country === 'UGA' ? 'Uganda' : 'Rwanda'} · since {dayFmt(o.createdAt)}
              {d.owner && (
                <>
                  {' '}
                  · owned by <RowLink href={`/users/${d.owner.id}`}>{d.owner.name ?? d.owner.username}</RowLink>
                </>
              )}
            </p>
            {o.description && <p className="mt-3 max-w-[72ch] text-[13px] text-ink-secondary">{o.description}</p>}
          </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {verificationBadge(o.verification)}
            {!o.isActive && <StatusBadge status="warning">Inactive</StatusBadge>}
            {o.isPrivate && <Tag>Private shop</Tag>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <VerifyOrganizerButtons organizerId={o.id} verification={o.verification} />
          <WithdrawalsSwitch organizerId={o.id} allowed={o.kycApproved} />
        </div>
        <div className="mt-6">
          <Facts
            items={[
              { label: 'Contact email', value: o.contactEmail ?? 'None' },
              { label: 'Contact phone', value: o.contactPhone ?? 'None' },
              { label: 'Events', value: `${d.events.total} (${d.events.upcoming} upcoming)` },
              { label: 'Team members', value: d.members.length },
            ]}
          />
        </div>
      </Panel>

      <Panel title={`Money in this period (${m.currency})`} actions={canFinanceExport ? <ExportButton path="/exports/transactions.csv" params={txParams} label="Export transactions" /> : undefined}>
        <Facts
          cols={6}
          items={[
            { label: 'GMV', value: fmt('money', m.gmv, m.currency, true), hint: 'Successful ticket, product and membership payments through a provider' },
            { label: 'Payments', value: fmt('count', m.payments) },
            { label: 'Commission', value: fmt('money', m.commission, m.currency, true) },
            { label: 'Take rate', value: fmt('ratio', m.takeRate) },
            { label: 'Failed payments', value: fmt('count', m.failed) },
            { label: 'Withdrawn', value: fmt('money', m.withdrawn, m.currency, true) },
          ]}
        />
        <div className="mt-4">
          <MiniLine points={m.points} unit="money" label={`GMV per day for ${o.name}`} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        <OrgEvents id={o.id} total={d.events.total} upcoming={d.events.upcoming} />
        <div className="flex flex-col gap-5">
          <Panel title="Wallets">
            {d.wallets.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No wallets.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[13px]">
                {d.wallets.map((w, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-secondary">{humanize(w.provider)}</span>
                    <span className="num text-ink">
                      {fmt('money', w.balance, w.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <OrganizerDocumentsPanel organizerId={o.id} />
          <Panel title="Team">
            <ul className="flex flex-col gap-2 text-[13px]">
              {d.members.map((mb, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar src={mb.imageUrl} name={mb.name ?? (mb.userId ? `#${mb.userId}` : 'Invited')} size={28} />
                    <span className="truncate">{mb.userId ? <RowLink href={`/users/${mb.userId}`}>{mb.name ?? `#${mb.userId}`}</RowLink> : mb.name ?? 'Invited'}</span>
                  </span>
                  <span className="shrink-0 text-ink-muted">{mb.isOwner ? 'owner' : mb.isActive ? 'member' : 'inactive'}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Commission rate requests">
            {d.commissionRequests.length === 0 ? (
              <p className="text-[13px] text-ink-muted">None.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[13px]">
                {d.commissionRequests.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span>
                      {c.percentage}% <span className="text-ink-muted">· {dayFmt(c.createdAt)}</span>
                    </span>
                    <span className="text-ink-secondary">{humanize(c.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <OrgTransactions id={o.id} />
    </div>
  );
}

const NO_PARAMS = new URLSearchParams();

function OrgEvents({ id, total, upcoming }: { id: number; total: number; upcoming: number }) {
  const p = useCursorPager<{ id: number; name: string; startDate: string; sold: number; capacity: number }>(`/organizers/${id}/events`, NO_PARAMS, { urlSize: false, initialSize: 10 });
  return (
    <Panel title="Events" freshness={`${total} events, ${upcoming} upcoming. Newest first; sales are lifetime.`}>
      {p.items.length === 0 && !p.isLoading ? (
        <p className="py-2 text-[13px] text-ink-muted">No events yet.</p>
      ) : (
        <Table minWidth={560} head={['Event', 'Starts', { label: 'Sold', align: 'right' }, { label: 'Sell-through', align: 'right' }, '']}>
          {p.items.map((e) => (
            <tr key={e.id} className="h-11 border-b border-line">
              <td className={`${tdFirst} max-w-[260px] truncate`}>
                <RowLink href={`/events/${e.id}`}>{e.name}</RowLink>
              </td>
              <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{dayFmt(e.startDate)}</td>
              <td className={`num ${td} text-right`}>{fmt('count', e.sold)}</td>
              <td className={`num ${td} text-right`}>{fmt('ratio', e.capacity ? e.sold / e.capacity : null)}</td>
              <OpenCell href={`/events/${e.id}`} name={e.name} />
            </tr>
          ))}
        </Table>
      )}
      <PagerBar pager={p} noun="events" sizes={[10, 25, 50]} />
    </Panel>
  );
}

function OrgTransactions({ id }: { id: number }) {
  const p = useCursorPager<{ id: number; createdAt: string; amount: number; currency: string; status: string; transactionType: string }>(`/organizers/${id}/transactions`, NO_PARAMS, {
    urlSize: false,
    initialSize: 10,
  });
  return (
    <Panel title="Transactions" freshness="Newest first, all types">
      {p.items.length === 0 && !p.isLoading ? (
        <p className="text-[13px] text-ink-muted">No transactions.</p>
      ) : (
        <ul className="hover-list flex flex-col">
          {p.items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px]">
              <span className="min-w-0 truncate">
                <RowLink href={`/transactions/${t.id}`}>#{t.id}</RowLink>
                <span className="ml-2 text-ink-secondary">{humanize(t.transactionType)}</span>
                <span className="ml-2 text-ink-muted">{formatRelative(t.createdAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <TxStatus status={t.status} />
                <span className="num text-ink">{fmt('money', t.amount, t.currency)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <PagerBar pager={p} noun="transactions" sizes={[10, 25, 50]} />
    </Panel>
  );
}
