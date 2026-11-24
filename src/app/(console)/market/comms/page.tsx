'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { dayFmt } from '@/components/directory-ui';
import { Button, ErrorState, Field, InlineEmpty, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

interface Req {
  id: number;
  title: string;
  body: string;
  audienceLabel: string;
  status: string;
  reach: number | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: string | null;
  mine: boolean;
}
const STATUS: Record<string, [React.ComponentProps<typeof StatusBadge>['status'], string]> = {
  pending: ['pending', 'Waiting for Sinc'],
  sent: ['ok', 'Sent'],
  rejected: ['critical', 'Rejected'],
  cancelled: ['info', 'Cancelled'],
  failed: ['critical', 'Failed'],
};

/** Ask Sinc to send a push to signed-in users in the partner's countries. Every request is approved by Sinc. */
export default function MarketCommsPage() {
  const can = useCan('market.comms.request');
  const sp = useSearchParams();
  const partnerId = sp.get('partnerId');
  const suffix = partnerId ? `?partnerId=${partnerId}` : '';
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['market-comms', partnerId], queryFn: () => api<{ items: Req[] }>(`/market/comms${suffix}`), enabled: can });
  const [f, setF] = useState({ title: '', body: '', reason: '' });
  const create = useMutation({
    mutationFn: () => api<{ reach: number | null }>(`/market/comms${suffix}`, { method: 'POST', json: f }),
    meta: { success: 'Sent to Sinc for approval' },
    onSuccess: () => {
      setF({ title: '', body: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['market-comms'] });
    },
  });
  const cancel = useMutation({
    mutationFn: (id: number) => api(`/market/comms/${id}/cancel${suffix}`, { method: 'POST' }),
    meta: { success: 'Request cancelled' },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['market-comms'] }),
  });
  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <Panel title="New push request" note="Goes to signed-in users in your countries who allow notifications, once the Sinc team approves it.">
        <form
          className="grid grid-cols-1 gap-4 lg:max-w-[720px]"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Title" htmlFor="mp-title" helper={`${f.title.length}/65`}>
            <input id="mp-title" required maxLength={65} className={inputClass} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Kampala Nights: tickets on sale" />
          </Field>
          <Field label="Message" htmlFor="mp-body" helper={`${f.body.length}/240`}>
            <textarea id="mp-body" required maxLength={240} rows={3} className={`${inputClass} h-auto py-2`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <Field label="Reason (for the Sinc team)" htmlFor="mp-reason">
            <input id="mp-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Biggest event of the month" />
          </Field>
          {create.error && <p className="text-[12px] text-ember-ink">{(create.error as Error).message}</p>}
          <div>
            <Button type="submit" loading={create.isPending} loadingText="Sending…" disabled={f.title.trim().length < 2 || f.body.trim().length < 2 || f.reason.trim().length < 5}>
              Ask Sinc to send
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="Your requests" freshness="Newest first">
        {list.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : list.error ? (
          <ErrorState what="push requests" message={(list.error as Error).message} requestId={(list.error as ApiError).requestId} onRetry={() => list.refetch()} />
        ) : !list.data?.items.length ? (
          <InlineEmpty>No requests yet.</InlineEmpty>
        ) : (
          <ul className="flex flex-col">
            {list.data.items.map((r) => {
              const [tone, label] = STATUS[r.status] ?? ['info', r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink">{r.title}</p>
                    <p className="text-[13px] text-ink-secondary">{r.body}</p>
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {r.audienceLabel}
                      {r.reach !== null && ` · about ${r.reach.toLocaleString('en')} devices`} · {r.requestedBy ?? 'Your team'} · {dayFmt(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={tone}>{label}</StatusBadge>
                    {r.status === 'pending' && r.mine && (
                      <Button variant="quiet" onClick={() => cancel.mutate(r.id)} loading={cancel.isPending && cancel.variables === r.id}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
