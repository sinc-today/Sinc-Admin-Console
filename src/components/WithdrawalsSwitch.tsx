'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { useInMarket } from '@/lib/market';
import { InfoTip } from './ui';
import { Modal } from './Modal';
import { Button, Field, inputClass, StatusBadge } from './ui';
import { api } from '@/lib/api';

/**
 * Shows whether an organizer can withdraw (kycApproved) and lets ops and finance switch it, with a reason.
 * Without organizers.withdrawals it is just the badge.
 */
export function WithdrawalsSwitch({ organizerId, allowed }: { organizerId: number; allowed: boolean }) {
  const can = useCan('organizers.withdrawals');
  const inMarket = useInMarket();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notifyOwner, setNotifyOwner] = useState(!allowed);
  const m = useMutation({
    meta: { success: 'Withdrawals updated' },
    mutationFn: () => api(`/organizers/${organizerId}/withdrawals`, { method: 'PATCH', json: { allowed: !allowed, reason, notifyOwner } }),
    onSuccess: () => {
      setOpen(false);
      setReason('');
      qc.invalidateQueries({ queryKey: ['organizer'] });
    },
  });
  const badge = allowed ? <StatusBadge status="ok">Withdrawals allowed</StatusBadge> : <StatusBadge status="pending">Withdrawals blocked</StatusBadge>;
  if (!can)
    return inMarket ? (
      <span className="inline-flex items-center gap-1">
        {badge}
        <InfoTip label="About withdrawals">Only the Sinc team can allow an organizer to withdraw.</InfoTip>
      </span>
    ) : (
      badge
    );
  return (
    <>
      {badge}
      <Button
        variant="secondary"
        onClick={() => {
          setNotifyOwner(!allowed);
          setOpen(true);
        }}
      >
        {allowed ? 'Block withdrawals' : 'Allow withdrawals'}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={allowed ? 'Block withdrawals' : 'Allow withdrawals'}
        description={
          allowed
            ? 'The organizer will not be able to withdraw their balance until this is switched back. Sales and their balance are not affected.'
            : 'The organizer can withdraw their balance straight away, without the identity check. Only do this when their identity was checked another way.'
        }
        width="max-w-[520px]"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={notifyOwner} onChange={(e) => setNotifyOwner(e.target.checked)} /> Notify the owner in the app
          </label>
          <Field label="Reason (recorded in the audit log)" htmlFor="wd-reason">
            <input id="wd-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={allowed ? 'e.g. Chargeback under investigation' : 'e.g. ID checked in person at the office'} />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending}>
              {allowed ? 'Block withdrawals' : 'Allow withdrawals'}
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
