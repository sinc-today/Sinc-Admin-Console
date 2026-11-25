'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountPicker } from '@/components/AccountPicker';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DotsThree } from '@phosphor-icons/react';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { tipFor } from '@/lib/glossary';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt, humanize, Tabs } from '@/components/analytics-ui';
import { BigNumber, ExportButton, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { PagerBar, useCursorPager, useOffsetPager } from '@/components/pager';
import { useScopeParams } from '@/lib/analytics';
import { Button, ErrorState, Field, InfoTip, InlineEmpty, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';
import { OrganizerPicker } from '@/components/OrganizerPicker';
import { Modal } from '@/components/Modal';
import { AccessResult, accessMessage } from '../shared';
import { Account, COUNTRY_NAME, Credits, SplitPreview, Terms, TermsFields, Totals, accountLabel, emptyTerms, kigaliToday, pct, termsPayload } from '../shared';

interface Detail {
  id: number;
  name: string;
  legalName: string | null;
  countries: string[];
  status: 'active' | 'suspended' | 'removed';
  contactEmail: string | null;
  note: string | null;
  account: Account | null;
  terms: Terms[];
  allTime: Totals[];
  operatorCredits: Credits;
  blockerCredits: Credits;
}

const TABS = ['overview', 'sales', 'statements', 'access', 'settings'] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = { overview: 'Overview', sales: 'Sales', statements: 'Statements', access: 'Access', settings: 'Settings' };

export default function PartnerPage() {
  const can = useCan('partners.read');
  const canManageRole = useCan('partners.manage');
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('overview'));
  const q = useQuery({ queryKey: ['partner', id], queryFn: () => api<Detail>(`/partners/${id}`), enabled: can });
  if (!can) return <NoAccess />;
  if (q.isLoading)
    return (
      <div className="flex flex-col gap-5" role="status" aria-label="Loading partner">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  if (q.error) return <ErrorState what="this partner" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const p = q.data!;
  // A deleted partner is read-only: its history stays visible, nothing can be changed.
  const canManage = canManageRole && p.status !== 'removed';
  const all = p.allTime[0];
  const cur = all?.currency ?? (p.countries[0] === 'UGA' ? 'UGX' : 'RWF');
  const c = p.operatorCredits;
  const tabs = TABS.filter((t) => t !== 'settings' || canManage);
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-secondary">
        <Link href="/partners" className="hover:underline">
          Partners
        </Link>{' '}
        / <span className="text-ink">{p.name}</span>
      </nav>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="display break-words text-[22px] leading-tight text-ink sm:text-[28px]">{p.name}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {p.countries.map((x) => COUNTRY_NAME[x] ?? x).join(', ')} · pays into {accountLabel(p.account)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {p.status === 'removed' ? (
              <StatusBadge status="info">Deleted</StatusBadge>
            ) : p.status === 'suspended' ? (
              <StatusBadge status="warning">Suspended</StatusBadge>
            ) : (
              <StatusBadge status="ok">Active</StatusBadge>
            )}
            {p.status !== 'active' && <InfoTip label="About this status">{p.status === 'removed' ? 'Kept for its statements and credits. Read only.' : 'No new shares. Sales stay with Sinc.'}</InfoTip>}
            <Link href={`/market?partnerId=${p.id}`} className="inline-flex h-10 items-center px-2 text-[13px] text-ink underline decoration-ember underline-offset-4">
              Preview their market
            </Link>
            {canManage && <MoreMenu items={[{ label: 'Edit details', onSelect: () => setTab('settings') }]} extra={<DeletePartner id={p.id} name={p.name} countries={p.countries} sales={all?.sales ?? 0} asMenuItem />} />}
          </div>
        </div>
      </Panel>

      <section aria-label="All-time figures" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="Operator share" value={fmt('money', all?.operatorShare ?? 0, cur, true)} sub={`All time · ${fmt('count', all?.sales ?? 0)} sales`} />
        <BigNumber label="Credited" tip={tipFor('Credited to their account')} value={fmt('money', c.credited.amount, cur, true)} sub={`${fmt('count', c.credited.count)} ${c.credited.count === 1 ? 'credit' : 'credits'}`} />
        <BigNumber
          label="Not credited yet"
          value={fmt('money', c.inFlight.amount + c.held.amount + c.failed.amount, cur, true)}
          sub={c.failed.count ? `${fmt('count', c.failed.count)} failed` : c.held.count ? `${fmt('count', c.held.count)} need an account` : c.inFlight.count ? 'Being credited' : 'Nothing waiting'}
        />
        <BigNumber
          label="Sinc keeps"
          value={fmt('money', all?.sincKeep ?? 0, cur, true)}
          sub={`Royalty ${fmt('money', all?.royalty ?? 0, cur, true)}${all?.blocker ? ` · blocker ${fmt('money', all.blocker, cur, true)}` : ''}`}
        />
      </section>

      {canManage && c.failed.count > 0 && <RetryFailed id={p.id} count={c.failed.count} />}
      {p.blockerCredits.held.count > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-panel bg-brass-wash px-5 py-3 text-[13px] text-brass-ink">
          {fmt('money', p.blockerCredits.held.amount, cur)} of blocker shares wait for the blocker&apos;s account.
          <InfoTip label="About held blocker shares">Schedule terms that set the blocker&apos;s Sinc account; held shares are then paid into it.</InfoTip>
        </p>
      )}

      <Tabs tabs={tabs.map((t) => ({ key: t, label: TAB_LABEL[t] }))} active={tab} onChange={(k) => setTab(k === 'overview' ? null : (k as (typeof TABS)[number]))} />

      {tab === 'overview' && (
        <>
          <TermsPanel p={p} />
          <ByEvent id={p.id} />
        </>
      )}
      {tab === 'sales' && <Sales id={p.id} />}
      {tab === 'statements' && <Statement id={p.id} />}
      {tab === 'access' && <PortalAccess id={p.id} canManage={canManage} />}
      {tab === 'settings' && canManage && (
        <>
          <ScheduleTerms p={p} />
          <EditPartner p={p} />
          <Panel title="Delete partner" note="Frees its countries for a new partner. Shares already owed are still paid.">
            <DeletePartner id={p.id} name={p.name} countries={p.countries} sales={all?.sales ?? 0} />
          </Panel>
        </>
      )}
    </div>
  );
}

/** "⋯" menu for secondary actions. */
function MoreMenu({ items, extra }: { items: { label: string; onSelect: () => void }[]; extra?: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label="More actions" title="More actions" className="flex size-10 items-center justify-center border border-line-strong text-ink hover:bg-fog">
        <DotsThree size={20} weight="bold" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 flex w-48 flex-col border border-line-strong bg-canvas py-1" style={{ borderRadius: 0 }}>
          {items.map((i) => (
            <Popover.Close key={i.label} asChild>
              <button type="button" onClick={i.onSelect} className="h-9 px-3 text-left text-[14px] text-ink hover:bg-fog">
                {i.label}
              </button>
            </Popover.Close>
          ))}
          {extra}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ------------------------------------------------------------------ terms */
function TermsPanel({ p }: { p: Detail }) {
  const [calc, setCalc] = useState(false);
  const current = p.terms.find((t) => t.state === 'in_force');
  return (
    <Panel
      title="Terms"
      info="Percentages are of the ticket price. Commission minus the provider fee is shared: Sinc's royalty and any blocker come off, the rest is the operator's."
      actions={
        current && (
          <Button variant="secondary" className="h-9 px-3 text-[14px]" onClick={() => setCalc(true)}>
            Split calculator
          </Button>
        )
      }
    >
      <Table minWidth={720} head={['Version', 'From', 'Sinc royalty', 'Blocker', 'Status', 'Note']}>
        {p.terms.map((t) => (
          <tr key={t.id} className="h-12 border-b border-line">
            <td className={`num ${tdFirst}`}>v{t.version}</td>
            <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>
              {t.effectiveFrom}
              {t.effectiveTo && <span className="text-ink-muted"> to {t.effectiveTo}</span>}
            </td>
            <td className={`num ${td}`}>{pct(t.royaltyPct)}</td>
            <td className={`${td} text-[13px]`}>
              {t.blockerPct > 0 ? (
                <>
                  {t.blockerLabel || 'Blocker'} {pct(t.blockerPct)}
                  <div className="text-[12px] text-ink-muted" title={`Pays into ${accountLabel(t.blockerAccount)}`}>
                    Sinc funds {pct(t.blockerSincPct)}
                  </div>
                </>
              ) : (
                <span className="text-ink-muted">None</span>
              )}
            </td>
            <td className={td}>{t.state === 'in_force' ? <StatusBadge status="ok">In force</StatusBadge> : t.state === 'scheduled' ? <StatusBadge status="pending">Scheduled</StatusBadge> : <StatusBadge status="info">Ended</StatusBadge>}</td>
            <td className={`${tdLast} max-w-[220px] truncate text-[12px] text-ink-muted`} title={t.note ?? undefined}>
              {t.note}
            </td>
          </tr>
        ))}
      </Table>
      {current && (
        <Modal open={calc} onClose={() => setCalc(false)} title="Split calculator" width="max-w-[720px]">
          <SplitPreview id="pp-preview" country={p.countries[0] ?? 'UGA'} terms={{ royaltyPct: String(current.royaltyPct), blockerPct: String(current.blockerPct), blockerSincPct: String(current.blockerSincPct) }} />
        </Modal>
      )}
    </Panel>
  );
}

function ScheduleTerms({ p }: { p: Detail }) {
  const qc = useQueryClient();
  const last = p.terms[0];
  const nextDay = last ? new Date(Math.max(Date.parse(`${last.effectiveFrom}T00:00:00Z`) + 86_400_000, Date.parse(`${kigaliToday()}T00:00:00Z`))).toISOString().slice(0, 10) : kigaliToday();
  const [draft, setDraft] = useState(() => ({ ...emptyTerms(nextDay), ...(last ? { royaltyPct: String(last.royaltyPct), blockerPct: String(last.blockerPct), blockerSincPct: String(last.blockerSincPct), blockerLabel: last.blockerLabel ?? '', blockerPayoutOrganizerProfileId: last.blockerPayoutOrganizerProfileId ? String(last.blockerPayoutOrganizerProfileId) : '' } : {}) }));
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/partners/${p.id}/terms`, { method: 'POST', json: { ...termsPayload(draft), reason } }),
    meta: { success: 'Terms scheduled' },
    onSuccess: () => {
      setReason('');
      qc.invalidateQueries({ queryKey: ['partner', String(p.id)] });
    },
  });
  return (
    <Panel title="Schedule new terms" note="Current terms end the day the new ones start.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TermsFields id="nt" value={draft} onChange={setDraft} />
            </div>
            <SplitPreview id="nt-preview" country={p.countries[0] ?? 'UGA'} terms={draft} />
            <Field label="Reason (audit log)" htmlFor="nt-reason">
              <input id="nt-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Grace period ends" />
            </Field>
            {save.error && <p className="text-[12px] text-ember-ink">{(save.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={save.isPending}>
                Save terms
              </Button>
            </div>
          </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ statement */
interface StatementData {
  month: string;
  byCurrency: {
    currency: string;
    totals: { sales: number; gross: number; commission: number; aggregatorFee: number; royalty: number; blocker: number; operatorShare: number; sincKeep: number };
    byGateway: { gateway: string; sales: number; gross: number; commission: number; aggregatorFee: number; royalty: number; blocker: number; operatorShare: number; sincKeep: number }[];
  }[];
  operatorCredited: { amount: number; count: number };
}

const thisMonth = () => kigaliToday().slice(0, 7);

function Statement({ id }: { id: number }) {
  const canExport = useCan('exports.finance');
  const [month, setMonth] = useState(thisMonth());
  const q = useQuery({ queryKey: ['partner-statement', id, month], queryFn: () => api<StatementData>(`/partners/${id}/statement?month=${month}`), enabled: /^\d{4}-\d{2}$/.test(month) });
  const params = new URLSearchParams({ month });
  return (
    <Panel
      title="Monthly statement"
      info="Sales by the month they happened (Kigali time), split under the terms in force that day."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="st-month" className="sr-only">
            Month
          </label>
          <input id="st-month" type="month" className={`${inputClass} w-[160px]`} value={month} max={thisMonth()} onChange={(e) => setMonth(e.target.value)} />
          {canExport && <ExportButton path={`/partners/${id}/statement.csv`} params={params} label="CSV" />}
        </div>
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : !q.data?.byCurrency.length ? (
        <InlineEmpty>No shared sales this month.</InlineEmpty>
      ) : (
        q.data.byCurrency.map((b) => (
          <div key={b.currency} className="flex flex-col gap-3">
            <Table minWidth={860} head={['Paid with', { label: 'Sales', align: 'right' }, { label: 'Tickets', align: 'right' }, { label: 'Commission', align: 'right' }, { label: 'Aggregator fees', align: 'right' }, { label: 'Sinc keeps', align: 'right' }, { label: 'Blocker', align: 'right' }, { label: 'Operator share', align: 'right' }]}>
              {[...b.byGateway, { gateway: 'Total', ...b.totals }].map((g) => (
                <tr key={g.gateway} className={`h-11 border-b border-line ${g.gateway === 'Total' ? 'font-medium' : ''}`}>
                  <td className={tdFirst}>{g.gateway === 'Total' ? 'Total' : humanize(g.gateway)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', g.sales)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.gross, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.commission, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.aggregatorFee, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.sincKeep, b.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', g.blocker, b.currency)}</td>
                  <td className={`num ${tdLast} text-right`}>{fmt('money', g.operatorShare, b.currency)}</td>
                </tr>
              ))}
            </Table>
            <p className="text-[12px] text-ink-muted">
              Credited this month: {fmt('money', q.data!.operatorCredited.amount, b.currency)} ({fmt('count', q.data!.operatorCredited.count)})
            </p>
          </div>
        ))
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ per event */
interface EventShare {
  rank: number;
  eventId: number | null;
  name: string | null;
  currency: string;
  sales: number;
  gross: number;
  commission: number;
  aggregatorFee: number;
  operatorShare: number;
  sincKeep: number;
  sharePct: number | null;
}

function ByEvent({ id }: { id: number }) {
  const { params } = useScopeParams();
  const qs = new URLSearchParams({ from: params.get('from')!, to: params.get('to')! });
  const pager = useOffsetPager<EventShare, { items: EventShare[]; total: number; from: string; to: string }>(`/partners/${id}/events`, qs, (r) => ({ items: r.items, total: r.total }), { initialSize: 10 });
  return (
    <Panel
      title="Share per event"
      info="For the dates at the top. The percentage differs by event because commissions and provider fees differ."
    >
      {pager.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : pager.error ? (
        <ErrorState message={(pager.error as Error).message} onRetry={() => pager.refetch()} />
      ) : !pager.items.length ? (
        <InlineEmpty>No shared sales in this period.</InlineEmpty>
      ) : (
        <>
          <Table minWidth={860} head={[{ label: 'Rank', align: 'right' }, 'Event', { label: 'Sales', align: 'right' }, { label: 'Tickets', align: 'right' }, { label: 'Commission', align: 'right' }, { label: 'Operator share', align: 'right' }, { label: 'Of ticket price', align: 'right' }]}>
            {pager.items.map((e) => (
              <tr key={`${e.eventId}-${e.currency}`} className="h-11 border-b border-line">
                <td className={`num ${tdFirst} text-right`}>#{e.rank}</td>
                <td className={`${td} max-w-[300px] truncate`}>
                  {e.eventId ? (
                    <Link href={`?event=${e.eventId}`} scroll={false} className="underline decoration-line-strong underline-offset-4">
                      {e.name ?? `Event #${e.eventId}`}
                    </Link>
                  ) : (
                    <span className="text-ink-muted" title="The sale could not be matched to a ticket or sign-up">
                      No event
                    </span>
                  )}
                </td>
                <td className={`num ${td} text-right`}>{fmt('count', e.sales)}</td>
                <td className={`num ${td} text-right`}>{fmt('money', e.gross, e.currency)}</td>
                <td className={`num ${td} text-right`}>{fmt('money', e.commission, e.currency)}</td>
                <td className={`num ${td} text-right`}>{fmt('money', e.operatorShare, e.currency)}</td>
                <td className={`num ${tdLast} text-right`}>{e.sharePct === null ? '–' : `${(e.sharePct * 100).toFixed(2)}%`}</td>
              </tr>
            ))}
          </Table>
          <PagerBar pager={pager} noun="events" sizes={[10, 25, 50]} />
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ sales */
interface SaleRow {
  transactionId: number;
  eventId: number | null;
  eventName: string | null;
  at: string;
  gateway: string;
  currency: string;
  gross: number;
  commission: number;
  aggregatorFee: number;
  royalty: number;
  blocker: number;
  operatorShare: number;
  sincKeep: number;
  shortfall: boolean;
  termsVersion: number;
  operatorStatus: string | null;
  operatorError: string | null;
}

const CREDIT_STATUS: Record<string, [React.ComponentProps<typeof StatusBadge>['status'], string]> = {
  applied: ['ok', 'Credited'],
  pending: ['pending', 'Queued'],
  claimed: ['pending', 'Crediting'],
  held: ['warning', 'Needs account'],
  failed: ['critical', 'Failed'],
};

function Sales({ id }: { id: number }) {
  const pager = useCursorPager<SaleRow>(`/partners/${id}/sales`, new URLSearchParams(), { urlSize: false, initialSize: 25 });
  const items = pager.items;
  // Columns that are the same on every visible row move into a caption.
  const oneGateway = items.length > 1 && items.every((s) => s.gateway === items[0].gateway);
  const oneTerms = items.length > 1 && items.every((s) => s.termsVersion === items[0].termsVersion);
  const caption = [oneGateway && `All ${humanize(items[0].gateway)}`, oneTerms && `terms v${items[0].termsVersion}`].filter(Boolean).join(' · ');
  return (
    <Panel title="Shared sales" freshness="Newest first">
      {pager.isLoading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading sales">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : pager.error ? (
        <ErrorState what="sales" message={(pager.error as Error).message} onRetry={() => pager.refetch()} />
      ) : !items.length ? (
        <InlineEmpty>No shared sales yet.</InlineEmpty>
      ) : (
        <>
          <Table
            sticky
            caption={caption || undefined}
            minWidth={880}
            head={['Payment', 'When', { label: 'Ticket', align: 'right' }, { label: 'Commission', align: 'right' }, { label: 'Fee', align: 'right' }, { label: 'Sinc keeps', align: 'right' }, { label: 'Operator', align: 'right' }, 'Credit']}
          >
            {items.map((s) => {
              const [tone, label] = CREDIT_STATUS[s.operatorStatus ?? ''] ?? ['info', s.operatorShare > 0 ? 'Unknown' : 'Nothing to credit'];
              const meta = [s.eventName ?? (s.eventId ? `Event #${s.eventId}` : 'No event'), !oneGateway && humanize(s.gateway), !oneTerms && `terms v${s.termsVersion}`].filter(Boolean).join(' · ');
              return (
                <tr key={s.transactionId} className="h-11 border-b border-line">
                  <td className={`num ${tdFirst}`}>
                    <Link href={`/transactions/${s.transactionId}`} className="underline decoration-line-strong underline-offset-4">
                      #{s.transactionId}
                    </Link>
                    <div className="max-w-[220px] truncate text-[12px] text-ink-muted" title={meta}>
                      {meta}
                    </div>
                  </td>
                  <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{new Date(s.at).toLocaleString('en-GB', { timeZone: 'Africa/Kigali', dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', s.gross, s.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', s.commission, s.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', s.aggregatorFee, s.currency)}</td>
                  <td className={`num ${td} text-right`}>{fmt('money', s.sincKeep, s.currency)}</td>
                  <td className={`num ${td} text-right`} title={s.shortfall ? 'Commission too low for an operator share' : undefined}>
                    {fmt('money', s.operatorShare, s.currency)}
                    {s.shortfall && <span className="ml-1 text-ember-ink">*</span>}
                  </td>
                  <td className={tdLast} title={s.operatorError ?? undefined}>
                    {s.operatorShare > 0 || s.operatorStatus ? <StatusBadge status={tone}>{label}</StatusBadge> : <span className="text-[12px] text-ink-muted">Nothing to credit</span>}
                  </td>
                </tr>
              );
            })}
          </Table>
          <PagerBar pager={pager} noun="sales" />
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ actions */
function RetryFailed({ id, count }: { id: number; count: number }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/partners/${id}/credits/retry`, { method: 'POST', json: { reason } }),
    meta: { success: 'Retry started' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner', String(id)] }),
  });
  return (
    <Panel title={`${count} credits failed`} info="Usually Sinc's wallet for that provider was too low. Top it up or check each sale's error, then retry." className="bg-ember-wash">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="min-w-[260px] flex-1">
          <Field label="Reason (audit log)" htmlFor="rt-reason">
            <input id="rt-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wallet topped up" />
          </Field>
        </div>
        <Button type="submit" loading={m.isPending}>
          Retry failed credits
        </Button>
      </form>
      {m.error && <p className="mt-2 text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
    </Panel>
  );
}

function EditPartner({ p }: { p: Detail }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: p.name, account: p.account ? String(p.account.id) : '', contactEmail: p.contactEmail ?? '', status: p.status, reason: '' });
  const m = useMutation({
    mutationFn: () =>
      api<{ released: number }>(`/partners/${p.id}`, {
        method: 'PATCH',
        json: { name: f.name, payoutOrganizerProfileId: f.account ? Number(f.account) : null, contactEmail: f.contactEmail || null, status: f.status, reason: f.reason },
      }),
    meta: { success: 'Partner saved' },
    onSuccess: () => {
      setF((x) => ({ ...x, reason: '' }));
      qc.invalidateQueries({ queryKey: ['partner', String(p.id)] });
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Panel title="Details" note="A new account only receives shares not credited yet. Suspending stops new shares; sales stay with Sinc.">
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <Field label="Name" htmlFor="ep-name">
          <input id="ep-name" required className={inputClass} value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Sinc operator account" htmlFor="ep-account">
          <OrganizerPicker id="ep-account" value={f.account} onChange={(v) => setF({ ...f, account: v })} initialLabel={p.account ? accountLabel(p.account) : null} />
        </Field>
        <Field label="Contact email" htmlFor="ep-email">
          <input id="ep-email" type="email" className={inputClass} value={f.contactEmail} onChange={set('contactEmail')} />
        </Field>
        <Field label="Status" htmlFor="ep-status">
          <select id="ep-status" className={inputClass} value={f.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Reason (audit log)" htmlFor="ep-reason">
            <input id="ep-reason" required minLength={5} className={inputClass} value={f.reason} onChange={set('reason')} placeholder="e.g. New payout account" />
          </Field>
        </div>
        {m.error && <p className="text-[12px] text-ember-ink md:col-span-2">{(m.error as Error).message}</p>}
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" loading={m.isPending}>
            Save details
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------------ dashboard access */
const PARTNER_ROLE_NAMES: Record<string, string> = { partner_owner: 'Owner', partner_ops: 'Operations', partner_support: 'Support', partner: 'Finance', partner_viewer: 'Viewer' };
const PARTNER_ROLE_HELP: Record<string, string> = {
  partner_owner: 'Everything below, plus inviting and managing their team.',
  partner_ops: 'Verify organizers, review reported posts, resend tickets.',
  partner_support: 'Look up organizers and events, resend tickets.',
  partner: 'Earnings, statements and the market view.',
  partner_viewer: 'Market view only.',
};
interface PartnerUser {
  id: number;
  name: string;
  email: string;
  role: string | null;
  status: string;
  twoFactor: boolean;
  lastLoginAt: string | null;
}

function PortalAccess({ id, canManage }: { id: number; canManage: boolean }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['partner-users', id], queryFn: () => api<{ items: PartnerUser[] }>(`/partners/${id}/users`) });
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('partner_owner');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<PartnerUser | null>(null);
  const [result, setResult] = useState<{ text: string; failed: boolean } | null>(null);
  const add = useMutation({
    mutationFn: () => api<AccessResult>(`/partners/${id}/users`, { method: 'POST', json: { email, name: name || null, role, reason } }),
    meta: { success: 'Access given' },
    onSuccess: (r) => {
      setResult({ text: accessMessage(email, r), failed: !r.emailSent });
      setEmail('');
      setName('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['partner-users', id] });
    },
  });
  const remove = useMutation({
    mutationFn: (staffId: number) => api(`/partners/${id}/users/${staffId}/remove`, { method: 'POST', json: { reason } }),
    meta: { success: 'Access removed' },
    onSuccess: () => {
      setRemoving(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['partner-users', id] });
    },
  });
  const closeAdd = () => {
    setAdding(false);
    setResult(null);
    add.reset();
  };
  return (
    <Panel
      title="Dashboard access"
      info="People here sign in with their Sinc account and 2FA and see only this partnership's countries. They must not have the ADMIN role. They can never allow withdrawals."
      actions={
        canManage && (
          <Button className="h-9 px-3 text-[14px]" onClick={() => setAdding(true)}>
            Give access
          </Button>
        )
      }
    >
      {users.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : !users.data?.items.length ? (
        <InlineEmpty>Nobody has access yet.</InlineEmpty>
      ) : (
        <ul className="flex flex-col">
          {users.data.items.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-[13px]">
              <span className="min-w-0">
                <span className="text-ink">{u.name}</span> <span className="text-ink-secondary">{u.email}</span>
                {u.role && <span className="ml-2 rounded-tag bg-fog px-2 py-0.5 text-[11px] text-ink-secondary">{PARTNER_ROLE_NAMES[u.role] ?? u.role}</span>}
                <span className="ml-2 text-[12px] text-ink-muted">
                  {u.status === 'ACTIVE' ? (u.twoFactor ? (u.lastLoginAt ? `Last sign-in ${new Date(u.lastLoginAt).toLocaleDateString('en-GB')}` : 'Never signed in') : 'No 2FA yet') : 'Removed'}
                </span>
              </span>
              {canManage && u.status === 'ACTIVE' && (
                <Button variant="quiet" onClick={() => setRemoving(u)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={adding} onClose={closeAdd} title="Give dashboard access" width="max-w-[520px]">
        {result && !add.error ? (
          <div className="flex flex-col gap-4">
            <p role="status" className={`text-[14px] ${result.failed ? 'text-ember-ink' : 'text-ink'}`}>
              {result.text}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setResult(null)}>Add another</Button>
              <Button variant="secondary" onClick={closeAdd}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <AccountPicker
              id="pu-find"
              onPick={(a) => {
                setEmail(a.email);
                setName((n) => n || a.name || a.username);
              }}
            />
            <Field label="Email" htmlFor="pu-email" helper="No Sinc account yet? One is created and a password emailed to them.">
              <input id="pu-email" type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="Name" htmlFor="pu-name">
              <input id="pu-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Role" htmlFor="pu-role" helper={PARTNER_ROLE_HELP[role]}>
              <select id="pu-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(PARTNER_ROLE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason (audit log)" htmlFor="pu-reason">
              <input id="pu-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Finance contact" />
            </Field>
            {add.error && <p className="text-[12px] text-ember-ink">{(add.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={add.isPending}>
                Give access
              </Button>
              <Button type="button" variant="secondary" onClick={closeAdd}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={removing ? `Remove ${removing.name}` : 'Remove access'} width="max-w-[480px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (removing) remove.mutate(removing.id);
          }}
        >
          <p className="text-[13px] text-ink-secondary">They are signed out and can no longer see this partnership.</p>
          <Field label="Reason (audit log)" htmlFor="pu-rm-reason">
            <input id="pu-rm-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Left the company" />
          </Field>
          {remove.error && <p className="text-[12px] text-ember-ink">{(remove.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={remove.isPending}>
              Remove access
            </Button>
            <Button type="button" variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

/**
 * Deletes a partner so its countries can be given to a new one. Without shared sales it is deleted
 * completely; with history it is kept (hidden) for its statements. Its dashboard users are signed out.
 */
function DeletePartner({ id, name, countries, sales, asMenuItem }: { id: number; name: string; countries: string[]; sales: number; asMenuItem?: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/partners/${id}`, { method: 'DELETE', json: { reason } }),
    meta: { success: 'Partner deleted' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      router.push('/partners');
    },
  });
  const where = countries.map((c) => COUNTRY_NAME[c] ?? c).join(' and ');
  return (
    <>
      {asMenuItem ? (
        <button type="button" onClick={() => setOpen(true)} className="h-9 px-3 text-left text-[14px] text-ember-ink hover:bg-fog">
          Delete partner
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Delete partner
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete ${name}`} width="max-w-[560px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <ul className="list-disc pl-5 text-[13px] leading-relaxed text-ink">
            <li>{where} becomes free, so you can add a new partner for it.</li>
            <li>From now on, sales there stay with Sinc until a new partner is added.</li>
            {sales > 0 ? (
              <li>
                It has {sales.toLocaleString('en')} shared sale{sales === 1 ? '' : 's'}, so it is kept out of sight for its statements and credits. Shares already owed are still paid.
              </li>
            ) : (
              <li>It has no shared sales, so it is deleted completely.</li>
            )}
            <li>Its dashboard users lose access and are signed out.</li>
          </ul>
          <Field label="Reason (audit log)" htmlFor="dp-reason">
            <input id="dp-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Licence ended; new operator signed" />
          </Field>
          <Field label={`Type ${name} to confirm`} htmlFor="dp-confirm">
            <input id="dp-confirm" required className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} disabled={confirm.trim() !== name.trim()}>
              Delete partner
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
