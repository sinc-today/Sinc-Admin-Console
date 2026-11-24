'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { Modal } from '@/components/Modal';
import { NoAccess } from '@/components/PhasePlaceholder';
import { dayFmt } from '@/components/directory-ui';
import { Button, ErrorState, Field, InlineEmpty, inputClass, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

interface Report {
  postId: number;
  reports: number;
  firstReportedAt: string;
  reasons: string[];
  event: { id: number; name: string | null } | null;
  organizerId: number | null;
  caption: string | null;
}

/** Posts people reported on events (or by organizers) in the partner's countries. Block or keep, with a reason. */
export default function MarketReportsPage() {
  const can = useCan('market.posts.moderate');
  const sp = useSearchParams();
  const partnerId = sp.get('partnerId');
  const suffix = partnerId ? `?partnerId=${partnerId}` : '';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['market-reports', partnerId], queryFn: () => api<{ items: Report[] }>(`/market/reports${suffix}`), enabled: can });
  const [deciding, setDeciding] = useState<{ post: Report; outcome: 'block' | 'keep' } | null>(null);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/market/reports/${deciding!.post.postId}/decision${suffix}`, { method: 'POST', json: { outcome: deciding!.outcome, reason } }),
    meta: { success: 'Decision saved' },
    onSuccess: () => {
      setDeciding(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['market-reports'] });
    },
  });
  if (!can) return <NoAccess />;
  return (
    <Panel title="Reported posts" freshness="Most reported first" info="Posts on events in your countries that people reported and that are still visible. Blocking hides the post in the app.">
      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.error ? (
        <ErrorState what="reported posts" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <InlineEmpty>Nothing to review.</InlineEmpty>
      ) : (
        <ul className="flex flex-col">
          {q.data.items.map((r) => (
            <li key={r.postId} className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
                  Post #{r.postId}
                  <StatusBadge status={r.reports >= 3 ? 'critical' : 'warning'}>
                    {r.reports} {r.reports === 1 ? 'report' : 'reports'}
                  </StatusBadge>
                  {r.reasons.map((x) => (
                    <Tag key={x}>{x}</Tag>
                  ))}
                </p>
                {r.caption && <p className="mt-1 max-w-[70ch] truncate text-[13px] text-ink-secondary">“{r.caption}”</p>}
                <p className="mt-1 text-[12px] text-ink-muted">
                  First reported {dayFmt(r.firstReportedAt)}
                  {r.event && (
                    <>
                      {' · '}
                      <AppLink href={`/events/${r.event.id}`} className="underline underline-offset-4">
                        {r.event.name ?? `Event #${r.event.id}`}
                      </AppLink>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="h-9 px-3 text-[14px]" onClick={() => setDeciding({ post: r, outcome: 'block' })}>
                  Block post
                </Button>
                <Button variant="secondary" className="h-9 px-3 text-[14px]" onClick={() => setDeciding({ post: r, outcome: 'keep' })}>
                  Keep
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!deciding} onClose={() => setDeciding(null)} title={deciding ? `${deciding.outcome === 'block' ? 'Block' : 'Keep'} post #${deciding.post.postId}` : ''} width="max-w-[480px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <p className="text-[13px] text-ink-secondary">{deciding?.outcome === 'block' ? 'The post is hidden in the app. The Sinc team can see who blocked it.' : 'The reports are closed and the post stays visible.'}</p>
          <Field label="Reason (audit log)" htmlFor="rp-reason">
            <input id="rp-reason" required minLength={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={deciding?.outcome === 'block' ? 'e.g. Spam link' : 'e.g. Real event, report mistaken'} />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} disabled={reason.trim().length < 3}>
              {deciding?.outcome === 'block' ? 'Block post' : 'Keep post'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
