'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { Modal } from '@/components/Modal';
import { NoAccess } from '@/components/PhasePlaceholder';
import { dayFmt } from '@/components/directory-ui';
import { Button, ErrorState, Field, InfoTip, InlineEmpty, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

interface Check {
  organizerId: number;
  organizer: string;
  status: string;
  checkedAt: string;
  decidedBy: 'partner' | 'sinc' | 'automatic' | null;
  nameOnId: string | null;
  document: string | null;
  idCheck: string | null;
  liveness: { status: string | null; score: number | null } | null;
  faceMatch: { status: string | null; score: number | null } | null;
  warnings: string[];
}

const scored = (x: { status: string | null; score: number | null } | null) => (!x ? '–' : `${x.status ?? ''}${x.score != null ? ` (${x.score})` : ''}`);

/**
 * Identity checks of organizer owners in the partner's countries. Accepting one verifies the identity only:
 * withdrawals stay closed until the Sinc team opens them.
 */
export default function MarketIdentityPage() {
  const can = useCan('market.identity.review');
  const sp = useSearchParams();
  const partnerId = sp.get('partnerId');
  const suffix = partnerId ? `?partnerId=${partnerId}` : '';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['market-identity', partnerId], queryFn: () => api<{ toReview: Check[]; waitingForSinc: Check[] }>(`/market/identity${suffix}`), enabled: can });
  const [deciding, setDeciding] = useState<{ c: Check; status: 'APPROVED' | 'DECLINED' } | null>(null);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/market/identity/${deciding!.c.organizerId}/decision${suffix}`, { method: 'POST', json: { status: deciding!.status, reason } }),
    meta: { success: 'Decision saved' },
    onSuccess: () => {
      setDeciding(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['market-identity'] });
    },
  });
  if (!can) return <NoAccess />;

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="To review"
        freshness={q.data ? `${q.data.toReview.length} waiting` : undefined}
        info="The automatic check declined these or wants a person to look. Accept only when the ID matches the organizer's owner. Accepting never opens withdrawals."
      >
        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : q.error ? (
          <ErrorState what="identity checks" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : !q.data?.toReview.length ? (
          <InlineEmpty>Nothing to review.</InlineEmpty>
        ) : (
          <ul className="flex flex-col">
            {q.data.toReview.map((c) => (
              <li key={c.organizerId} className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
                    <AppLink href={`/organizers/${c.organizerId}`} className="underline decoration-line-strong underline-offset-4">
                      {c.organizer}
                    </AppLink>
                    <StatusBadge status={c.status === 'IN_REVIEW' ? 'warning' : 'critical'}>{c.status === 'IN_REVIEW' ? 'Needs a person' : 'Declined automatically'}</StatusBadge>
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
                    <Fact label="Name on ID" value={c.nameOnId ?? 'Not received'} />
                    <Fact label="Document" value={c.document ?? '–'} />
                    <Fact label="Liveness" value={scored(c.liveness)} />
                    <Fact label="Face match" value={scored(c.faceMatch)} />
                  </dl>
                  {c.warnings.length > 0 && <p className="mt-1 text-[12px] text-ember-ink">{c.warnings.join('; ')}</p>}
                  <p className="mt-1 text-[12px] text-ink-muted">Checked {dayFmt(c.checkedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button className="h-9 px-3 text-[14px]" onClick={() => setDeciding({ c, status: 'APPROVED' })}>
                    Accept identity
                  </Button>
                  <Button variant="secondary" className="h-9 px-3 text-[14px]" onClick={() => setDeciding({ c, status: 'DECLINED' })}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Verified, waiting for Sinc" info="Identity accepted. The Sinc team opens withdrawals; the owner is notified when they do.">
        {q.data && !q.data.waitingForSinc.length ? (
          <InlineEmpty>None waiting.</InlineEmpty>
        ) : (
          <ul className="hover-list flex flex-col">
            {(q.data?.waitingForSinc ?? []).map((c) => (
              <li key={c.organizerId} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2 text-[13px]">
                <AppLink href={`/organizers/${c.organizerId}`} className="text-ink underline decoration-line-strong underline-offset-4">
                  {c.organizer}
                </AppLink>
                <span className="flex items-center gap-2 text-ink-muted">
                  Verified by {c.decidedBy === 'partner' ? 'your team' : c.decidedBy === 'automatic' ? 'the automatic check' : 'Sinc'} · {dayFmt(c.checkedAt)}
                  <StatusBadge status="pending">Withdrawals closed</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal open={!!deciding} onClose={() => setDeciding(null)} title={deciding ? `${deciding.status === 'APPROVED' ? 'Accept' : 'Decline'} identity: ${deciding.c.organizer}` : ''} width="max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <p className="flex items-start gap-1 text-[13px] text-ink-secondary">
            {deciding?.status === 'APPROVED'
              ? 'The owner is told their identity is verified. Withdrawals stay closed until the Sinc team opens them.'
              : 'The owner is asked to try again at their next withdrawal.'}
            <InfoTip label="About identity decisions">Your decision is recorded with your name. The Sinc team can still review it.</InfoTip>
          </p>
          <Field label="Reason (audit log)" htmlFor="id-reason">
            <input id="id-reason" required minLength={3} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={deciding?.status === 'APPROVED' ? 'e.g. ID matches the registered owner' : 'e.g. Photo unreadable'} />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} disabled={reason.trim().length < 3}>
              {deciding?.status === 'APPROVED' ? 'Accept identity' : 'Decline'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDeciding(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </div>
  );
}
