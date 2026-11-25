'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NumberInput } from './NumberInput';
import { useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api } from '@/lib/api';
import { Modal } from './Modal';
import { Button, Field, inputClass, Panel } from './ui';

export interface OrganizerPlan {
  id: number;
  planName: string | null;
  commissionPercentage: number | null;
  consumablePercentage: number | null;
  shopPercentage: number | null;
  updatedAt: string;
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'Not set' : `${v}%`);

/**
 * Sinc's commission for one organizer, from their plan subscription: non-consumable tickets, consumable tickets
 * (drinks, food, merchandise vouchers) and shop sales. Staff with organizers.commission can change the ticket ones.
 */
export function OrganizerCommissionPanel({ organizerId, plan }: { organizerId: number; plan: OrganizerPlan | null }) {
  const canChange = useCan('organizers.commission');
  const [open, setOpen] = useState(false);
  return (
    <Panel
      title="Commission"
      info="Sinc's percentage on this organizer's sales. Non-consumable tickets are entry tickets; consumable tickets are vouchers for drinks, food or merchandise. Changes apply to sales from now on, and are recorded in the audit log."
      actions={
        canChange && plan ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Change
          </Button>
        ) : undefined
      }
    >
      {!plan ? (
        <p className="text-[13px] text-ink-muted">This organizer has no plan subscription yet, so there is no commission to set.</p>
      ) : (
        <ul className="flex flex-col text-[13px]">
          <li className="flex items-baseline justify-between gap-3 border-b border-line py-2 first:pt-0">
            <span className="text-ink-secondary">Non-consumable tickets</span>
            <span className="num text-[18px] font-medium text-ink">{pct(plan.commissionPercentage)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="text-ink-secondary">Consumable tickets</span>
            <span className="num text-[18px] font-medium text-ink">{pct(plan.consumablePercentage)}</span>
          </li>
          <li className="flex items-baseline justify-between gap-3 py-2 last:pb-0">
            <span className="text-ink-secondary">Shop sales</span>
            <span className="num text-ink">{pct(plan.shopPercentage)}</span>
          </li>
          {plan.planName && <li className="pt-1 text-[12px] text-ink-muted">Plan: {plan.planName}</li>}
        </ul>
      )}
      {open && plan && <CommissionDialog organizerId={organizerId} plan={plan} onClose={() => setOpen(false)} />}
    </Panel>
  );
}

function CommissionDialog({ organizerId, plan, onClose }: { organizerId: number; plan: OrganizerPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ commission: String(plan.commissionPercentage ?? ''), consumable: String(plan.consumablePercentage ?? ''), reason: '' });
  const valid = (v: string) => /^\d{1,3}$/.test(v) && Number(v) <= 100;
  const changed = Number(f.commission) !== plan.commissionPercentage || Number(f.consumable) !== plan.consumablePercentage;
  const m = useMutation({
    mutationFn: () =>
      api(`/organizers/${organizerId}/commission`, {
        method: 'PATCH',
        json: { commissionPercentage: Number(f.commission), consumablePercentage: Number(f.consumable), reason: f.reason },
      }),
    meta: { success: 'Commission updated' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organizer'] });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title="Change commission" description="Whole percentages from 0 to 100. Sales already made keep the rate they were made with." width="max-w-[520px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Non-consumable tickets (%)" htmlFor="oc-commission" helper="Entry tickets">
            <NumberInput id="oc-commission" min={0} max={100} step={1} required className={inputClass} value={f.commission} onValue={(t) => setF({ ...f, commission: t })} />
          </Field>
          <Field label="Consumable tickets (%)" htmlFor="oc-consumable" helper="Drinks, food, merchandise">
            <NumberInput id="oc-consumable" min={0} max={100} step={1} required className={inputClass} value={f.consumable} onValue={(t) => setF({ ...f, consumable: t })} />
          </Field>
        </div>
        <Field label="Reason (audit log)" htmlFor="oc-reason">
          <input id="oc-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Agreed partnership rate" />
        </Field>
        {(!valid(f.commission) || !valid(f.consumable)) && <p className="text-[12px] text-ember-ink">Use whole numbers from 0 to 100.</p>}
        {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={m.isPending} disabled={!valid(f.commission) || !valid(f.consumable) || !changed || f.reason.trim().length < 5}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
