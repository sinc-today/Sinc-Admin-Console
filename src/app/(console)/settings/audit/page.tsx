'use client';

import { PagerBar, useCursorPager } from '@/components/pager';
import { parseAsString, useQueryStates } from 'nuqs';
import { Fragment, useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { Button, EmptyState, ErrorState, Field, inputClass, Panel, Skeleton, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { FilterBar, SearchForm } from '@/components/directory-ui';
import { useCan } from '../../me-context';

interface AuditItem {
  id: string;
  occurredAt: string;
  actor: { staffId: number; name: string | null; role: string | null } | null;
  actorUserId: number | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  requestId: string | null;
}

/** Plain-language labels for known actions; unknown actions show their key. */
const ACTION_LABELS: Record<string, string> = {
  'staff.login': 'Signed in',
  'staff.logout': 'Signed out',
  'staff.login_failed': 'Failed sign-in',
  'staff.login_denied': 'Sign-in refused',
  'staff.mfa_enrolled': 'Turned on two-factor',
  'staff.mfa_failed': 'Wrong two-factor code',
  'staff.mfa_reset': 'Reset two-factor',
  'staff.bootstrap_owner': 'Became first owner',
  'staff.add': 'Added staff member',
  'staff.role_change': 'Changed role',
  'staff.status_change': 'Changed access',
};

const SECURITY_ACTIONS = new Set(['staff.login_failed', 'staff.login_denied', 'staff.mfa_failed']);

export default function AuditPage() {
  const canRead = useCan('audit.read');
  const [filters, setFilters] = useQueryStates({ action: parseAsString, targetType: parseAsString, targetId: parseAsString });
  const [draft, setDraft] = useState({ action: filters.action ?? '', targetType: filters.targetType ?? '', targetId: filters.targetId ?? '' });
  const [open, setOpen] = useState<string | null>(null);

  const auditParams = new URLSearchParams();
  if (filters.action) auditParams.set('action', filters.action);
  if (filters.targetType) auditParams.set('targetType', filters.targetType);
  if (filters.targetId) auditParams.set('targetId', filters.targetId);
  const q = useCursorPager<AuditItem>('/audit', auditParams, { enabled: canRead });

  if (!canRead) return <NoAccess />;
  const items = q.items;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        search={<SearchForm id="f-action" label="Filter by action" placeholder="Action, e.g. staff.* or partners.delete" initial={filters.action ?? ''} onSearch={(v) => setFilters({ action: v })} />}
        filters={
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ targetType: draft.targetType || null, targetId: draft.targetId || null });
            }}
          >
            <Field label="Target type" htmlFor="f-type">
              <input id="f-type" value={draft.targetType} onChange={(e) => setDraft({ ...draft, targetType: e.target.value })} className={inputClass} placeholder="staff, user, organizer…" />
            </Field>
            <Field label="Target id" htmlFor="f-id">
              <input id="f-id" value={draft.targetId} onChange={(e) => setDraft({ ...draft, targetId: e.target.value })} className={inputClass} placeholder="Exact id" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" className="h-9 px-3 text-[14px]">
                Apply
              </Button>
            </div>
          </form>
        }
        active={[
          ...(filters.targetType ? [{ key: 'type', label: `Target: ${filters.targetType}`, onRemove: () => (setFilters({ targetType: null }), setDraft((d) => ({ ...d, targetType: '' }))) }] : []),
          ...(filters.targetId ? [{ key: 'id', label: `Id: ${filters.targetId}`, onRemove: () => (setFilters({ targetId: null }), setDraft((d) => ({ ...d, targetId: '' }))) }] : []),
        ]}
      />

      <Panel title="Activity" freshness="Newest first" info="Entries can't be edited or deleted. Open Details for the before and after values.">
        {q.isLoading ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : q.error ? (
          <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="Nothing recorded for these filters" body="Clear the filters to see everything." />
        ) : (
          <div className="relative -mx-4 sm:-mx-6 overflow-x-auto">
            <table className="rt w-full min-w-[880px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-fog text-left text-[12px] text-ink-secondary">
                  <th scope="col" className="h-10 px-6 font-medium">When</th>
                  <th scope="col" className="px-4 font-medium">Who</th>
                  <th scope="col" className="px-4 font-medium">Action</th>
                  <th scope="col" className="px-4 font-medium">Target</th>
                  <th scope="col" className="px-4 font-medium">Reason</th>
                  <th scope="col" className="px-6 font-medium"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <Fragment key={it.id}>
                    <tr className="h-11 border-b border-line hover:bg-fog">
                      <td className="num whitespace-nowrap px-6 text-ink-secondary">{formatDateTime(it.occurredAt)}</td>
                      <td className="px-4 text-ink">
                        {it.actor?.name ?? (it.actorUserId ? `User ${it.actorUserId}` : 'Unknown')}
                        {it.actor?.role && <span className="ml-2 text-[12px] text-ink-muted">{it.actor.role}</span>}
                      </td>
                      <td className="px-4">
                        <span className={SECURITY_ACTIONS.has(it.action) ? 'text-ember-ink' : 'text-ink'}>{ACTION_LABELS[it.action] ?? it.action}</span>
                      </td>
                      <td className="px-4">{it.targetType ? <Tag>{`${it.targetType} ${it.targetId ?? ''}`.trim()}</Tag> : <span className="text-ink-muted">None</span>}</td>
                      <td className="max-w-[280px] truncate px-4 text-ink-secondary" title={it.reason ?? undefined}>
                        {it.reason ?? ''}
                      </td>
                      <td className="px-6 text-right">
                        <Button variant="quiet" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)}>
                          {open === it.id ? 'Hide' : 'Details'}
                        </Button>
                      </td>
                    </tr>
                    {open === it.id && (
                      <tr className="border-b border-line bg-fog">
                        <td colSpan={6} className="px-6 py-4">
                          <dl className="grid grid-cols-1 gap-4 text-[12px] md:grid-cols-4">
                            <Detail label="Action key" value={it.action} />
                            <Detail label="IP" value={it.ip ?? 'Unknown'} />
                            <Detail label="Request id" value={it.requestId ?? 'None'} />
                            <Detail label="Entry" value={`#${it.id}`} />
                          </dl>
                          {(it.before != null || it.after != null) && (
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                              <Json label="Before" value={it.before} />
                              <Json label="After" value={it.after} />
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PagerBar pager={q} noun="entries" />
      </Panel>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-ink-muted">{label}</dt>
      <dd className="num mt-1 break-all text-ink">{value}</dd>
    </div>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-ink-muted">{label}</p>
      <pre className="mt-1 overflow-x-auto bg-canvas p-3 text-[12px] leading-relaxed text-ink">{value == null ? 'None' : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
