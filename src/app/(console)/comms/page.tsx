'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { Button, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge, InfoTip } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { PagerBar, useClientPager } from '@/components/pager';
import { formatRelative } from '@/lib/format';
import { useCan } from '../me-context';

interface Audience {
  key: 'all' | 'signed_in';
  label: string;
  devices: number | null;
  needsApproval: boolean;
}
interface Req {
  id: number;
  title: string;
  body: string;
  audience: string;
  audienceLabel: string;
  status: 'pending' | 'sent' | 'rejected' | 'failed' | 'cancelled';
  reach: number | null;
  reason: string | null;
  result: { ok?: boolean; error?: string } | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: string;
  fromPartner?: string | null;
  decidedBy: string | null;
  mine: boolean;
}

const STATUS: Record<Req['status'], [React.ComponentProps<typeof StatusBadge>['status'], string]> = {
  pending: ['pending', 'Waiting for approval'],
  sent: ['ok', 'Sent'],
  rejected: ['info', 'Rejected'],
  cancelled: ['info', 'Cancelled'],
  failed: ['critical', 'Failed'],
};

export default function CommsPage() {
  const can = useCan('comms.send');
  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <Compose />
      <History />
    </div>
  );
}

function Preview({ title, body, platform }: { title: string; body: string; platform: 'iOS' | 'Android' }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[12px] font-medium text-ink-secondary">{platform}</figcaption>
      <div className={platform === 'iOS' ? 'rounded-[18px] bg-fog p-3' : 'rounded-[6px] bg-fog p-3'}>
        <div className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span aria-hidden className="inline-block size-4 rounded-[4px] bg-ink" />
          <span>Sinc</span>
          <span className="ml-auto">now</span>
        </div>
        <p className="mt-1.5 truncate text-[14px] font-semibold text-ink">{title || 'Title'}</p>
        <p className={platform === 'iOS' ? 'line-clamp-4 text-[13px] text-ink' : 'line-clamp-2 text-[13px] text-ink'}>{body || 'Message'}</p>
      </div>
    </figure>
  );
}

function Compose() {
  const qc = useQueryClient();
  const reach = useQuery({ queryKey: ['comms-reach'], queryFn: () => api<{ audiences: Audience[] }>('/comms/reach') });
  const [f, setF] = useState({ title: '', body: '', audience: 'signed_in' as Audience['key'], reason: '' });
  const [done, setDone] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api<{ id: number; status: string }>('/comms/requests', { method: 'POST', json: f }),
    meta: { silent: true },
    onSuccess: (r) => {
      setDone(r.status === 'pending' ? 'Waiting for a second approver.' : 'Sent.');
      setF({ title: '', body: '', audience: f.audience, reason: '' });
      qc.invalidateQueries({ queryKey: ['comms-requests'] });
    },
  });
  const aud = reach.data?.audiences.find((a) => a.key === f.audience);
  return (
    <Panel title="New push" info="Sent through the user service to the Sinc app.">
      <form
        className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
        onSubmit={(e) => {
          e.preventDefault();
          setDone(null);
          create.mutate();
        }}
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="c-title" helper={`${f.title.length}/65`}>
            <input id="c-title" required maxLength={65} className={inputClass} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Message" htmlFor="c-body" helper={`${f.body.length}/240`}>
            <textarea id="c-body" required maxLength={240} rows={3} className={`${inputClass} h-auto py-2`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Audience</legend>
            {reach.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="flex flex-col gap-2">
                {(reach.data?.audiences ?? []).map((a) => (
                  <label key={a.key} className="flex cursor-pointer items-start gap-3 bg-fog p-3">
                    <input type="radio" name="audience" value={a.key} checked={f.audience === a.key} onChange={() => setF({ ...f, audience: a.key })} className="mt-1" />
                    <span>
                      <span className="block text-[14px] text-ink">{a.label}</span>
                      <span className="num block text-[12px] text-ink-secondary">
                        {a.devices === null ? 'Reach unknown' : `About ${fmt('count', a.devices)} devices`} · {a.needsApproval ? 'needs a second approver' : 'sent straight away'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <Field label="Reason (audit log)" htmlFor="c-reason">
            <input id="c-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Amahoro concert tickets on sale" />
          </Field>
          {create.error && <p className="text-[12px] text-ember-ink">{(create.error as Error).message}</p>}
          {done && (
            <p role="status" className="text-[13px] text-ink">
              {done}
            </p>
          )}
          {aud?.needsApproval && <p className="text-[12px] text-ink-secondary">Needs a second person with Comms access to approve before it is sent.</p>}
          <div className="flex items-center gap-1">
            <Button type="submit" loading={create.isPending} loadingText={aud?.needsApproval ? 'Requesting…' : 'Sending…'}>
              {aud?.needsApproval ? 'Ask for approval' : `Send to ${aud?.devices !== null && aud?.devices !== undefined ? fmt('count', aud.devices) : ''} devices`}
            </Button>
            <InfoTip label="Approval rules">Pushes to every device need a second approver. Smaller audiences send straight away. Users who turned notifications off are skipped.</InfoTip>
          </div>
        </div>
        <div className="flex flex-col gap-4" aria-label="Preview">
          <Preview platform="iOS" title={f.title} body={f.body} />
          <Preview platform="Android" title={f.title} body={f.body} />
        </div>
      </form>
    </Panel>
  );
}

function History() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['comms-requests'], queryFn: () => api<{ items: Req[] }>('/comms/requests') });
  const pager = useClientPager(q.data?.items ?? [], 10);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: 'approve' | 'reject' | 'cancel' }) => api(`/comms/requests/${v.id}/decision`, { method: 'POST', json: { decision: v.decision, reason } }),
    meta: { success: 'Decision saved' },
    onSuccess: () => {
      setRejecting(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['comms-requests'] });
    },
  });
  return (
    <Panel title="History" freshness="Waiting first">
      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <p className="py-2 text-[13px] text-ink-muted">No pushes yet.</p>
      ) : (
        <ul className="flex flex-col">
          {pager.items.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 border-b border-line py-4 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-ink">{r.title}</p>
                  <p className="text-[13px] text-ink-secondary">{r.body}</p>
                  <p className="num mt-1 text-[12px] text-ink-muted">
                    {r.audienceLabel} · {r.reach !== null ? `${fmt('count', r.reach)} devices` : 'reach unknown'} · asked by {r.requestedBy}{r.fromPartner ? ` (${r.fromPartner})` : ''} {formatRelative(r.createdAt)}
                    {r.decidedBy && ` · ${r.status === 'sent' ? 'approved' : r.status} by ${r.decidedBy}`}
                    {r.reason && ` · ${r.reason}`}
                  </p>
                  {r.status === 'failed' && r.result?.error && <p className="mt-1 text-[12px] text-ember-ink">{r.result.error}</p>}
                </div>
                <StatusBadge status={STATUS[r.status][0]}>{STATUS[r.status][1]}</StatusBadge>
              </div>
              {r.status === 'pending' &&
                (r.mine ? (
                  <div>
                    <Button variant="secondary" onClick={() => decide.mutate({ id: r.id, decision: 'cancel' })} loading={decide.isPending && decide.variables?.id === r.id}>
                      Cancel request
                    </Button>
                  </div>
                ) : rejecting === r.id ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      decide.mutate({ id: r.id, decision: 'reject' });
                    }}
                  >
                    <div className="min-w-[240px] flex-1">
                      <Field label="Why reject it?" htmlFor={`rj-${r.id}`}>
                        <input id={`rj-${r.id}`} required minLength={3} autoFocus className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
                      </Field>
                    </div>
                    <Button type="submit" loading={decide.isPending}>
                      Reject
                    </Button>
                    <Button type="button" variant="quiet" onClick={() => setRejecting(null)}>
                      Back
                    </Button>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide.mutate({ id: r.id, decision: 'approve' })} loading={decide.isPending && decide.variables?.decision === 'approve'}>
                      Approve and send to {r.reach !== null ? fmt('count', r.reach) : 'all'} devices
                    </Button>
                    <Button variant="secondary" onClick={() => setRejecting(r.id)}>
                      Reject
                    </Button>
                  </div>
                ))}
            </li>
          ))}
        </ul>
      )}
      <PagerBar pager={pager} noun="pushes" sizes={[10, 25, 50]} />
      {decide.error && <p className="mt-2 text-[12px] text-ember-ink">{(decide.error as Error).message}</p>}
    </Panel>
  );
}
