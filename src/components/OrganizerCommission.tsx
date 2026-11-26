'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LockSimple } from '@phosphor-icons/react';
import { NumberInput } from './NumberInput';
import { useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useInMarket } from '@/lib/market';
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

export interface CommissionChange {
  id: number;
  createdAt: string;
  previousCommissionPercentage: number | null;
  previousConsumablePercentage: number | null;
  commissionPercentage: number | null;
  consumablePercentage: number | null;
  source: string;
  actor: string | null;
  reason: string | null;
}

export interface OrganizerCommissionInfo {
  /** Events still taking payments: the commission can't change until they end. */
  lockedBy: { id: number; name: string; startDate: string | null; endDate: string | null }[];
  history: CommissionChange[];
  /** Licence partners only: the range Sinc lets them set; null = not set yet. */
  range?: { min: number; max: number } | null;
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? 'Not set' : `${v}%`);
const SOURCE: Record<string, string> = { ADMIN: 'Sinc staff', PARTNER: 'Licence partner', REQUEST: "Organizer's request, approved by Sinc" };

/**
 * Sinc's commission for one organizer, from their plan subscription: non-consumable tickets, consumable tickets
 * (drinks, food, merchandise vouchers) and shop sales. Staff with organizers.commission (and licence partners with
 * market.commission, inside their range) can change the ticket ones, never while an event is taking payments.
 * Every change is listed below with who made it and why; each sale also keeps the rate it was charged at.
 */
export function OrganizerCommissionPanel({ organizerId, plan, commission }: { organizerId: number; plan: OrganizerPlan | null; commission?: OrganizerCommissionInfo }) {
  const canChange = useCan('organizers.commission');
  const inMarket = useInMarket();
  const [open, setOpen] = useState(false);
  const locked = commission?.lockedBy ?? [];
  const range = inMarket ? commission?.range ?? null : null;
  const noRange = inMarket && !range;
  const history = commission?.history ?? [];
  return (
    <Panel
      title="Commission"
      info="Sinc's percentage on this organizer's sales. Non-consumable tickets are entry tickets; consumable tickets are vouchers for drinks, food or merchandise. It can't change while an event is taking payments. Changes apply to sales from then on; each sale keeps the rate it was charged at."
      actions={
        canChange && plan ? (
          <Button variant="secondary" disabled={locked.length > 0 || noRange} onClick={() => setOpen(true)}>
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

      {plan && locked.length > 0 && (
        <div role="status" className="mt-3 flex gap-2 rounded-tag bg-fog p-3 text-[13px] text-ink">
          <LockSimple size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Locked while {locked.length === 1 ? 'an event is' : `${locked.length} events are`} taking payments:{' '}
            {locked.slice(0, 3).map((e, i) => (
              <span key={e.id}>
                {i > 0 && ', '}
                {e.name}
                {e.endDate && <span className="text-ink-muted"> (ends {formatDateTime(e.endDate)})</span>}
              </span>
            ))}
            {locked.length > 3 && ` and ${locked.length - 3} more`}. It can change once {locked.length === 1 ? 'it ends' : 'they end'}.
          </span>
        </div>
      )}
      {plan && inMarket && canChange && (
        <p className="mt-3 text-[12px] text-ink-muted">
          {range ? `You can set from ${range.min}% to ${range.max}%, as agreed with Sinc.` : 'Sinc has not set the commission range for your partnership yet, so you cannot change it. Ask Sinc to set one.'}
        </p>
      )}

      {history.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[12px] font-medium text-ink-secondary">History</p>
          <ul className="flex flex-col gap-2 text-[13px]">
            {history.slice(0, 10).map((h) => (
              <li key={h.id} className="flex flex-col">
                <span className="text-ink">
                  {h.previousCommissionPercentage !== h.commissionPercentage && (
                    <span className="num">
                      Non-consumable {pct(h.previousCommissionPercentage)} → {pct(h.commissionPercentage)}
                    </span>
                  )}
                  {h.previousCommissionPercentage !== h.commissionPercentage && h.previousConsumablePercentage !== h.consumablePercentage && ' · '}
                  {h.previousConsumablePercentage !== h.consumablePercentage && (
                    <span className="num">
                      Consumable {pct(h.previousConsumablePercentage)} → {pct(h.consumablePercentage)}
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {formatDateTime(h.createdAt)} · {SOURCE[h.source] ?? h.source}
                  {h.actor ? ` · ${h.actor}` : ''}
                  {h.reason ? ` · ${h.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && plan && <CommissionDialog organizerId={organizerId} plan={plan} range={range} onClose={() => setOpen(false)} />}
    </Panel>
  );
}

function CommissionDialog({ organizerId, plan, range, onClose }: { organizerId: number; plan: OrganizerPlan; range: { min: number; max: number } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ commission: String(plan.commissionPercentage ?? ''), consumable: String(plan.consumablePercentage ?? ''), reason: '' });
  const lo = range?.min ?? 0;
  const hi = range?.max ?? 100;
  const valid = (v: string) => /^\d{1,3}$/.test(v) && Number(v) >= lo && Number(v) <= hi;
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
    <Modal open onClose={onClose} title="Change commission" description={`Whole percentages from ${lo} to ${hi}. Sales already made keep the rate they were charged at.`} width="max-w-[520px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Non-consumable tickets (%)" htmlFor="oc-commission" helper="Entry tickets">
            <NumberInput id="oc-commission" min={lo} max={hi} step={1} required className={inputClass} value={f.commission} onValue={(t) => setF({ ...f, commission: t })} />
          </Field>
          <Field label="Consumable tickets (%)" htmlFor="oc-consumable" helper="Drinks, food, merchandise">
            <NumberInput id="oc-consumable" min={lo} max={hi} step={1} required className={inputClass} value={f.consumable} onValue={(t) => setF({ ...f, consumable: t })} />
          </Field>
        </div>
        <Field label="Reason (kept in the commission history)" htmlFor="oc-reason">
          <input id="oc-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Agreed partnership rate" />
        </Field>
        {(!valid(f.commission) || !valid(f.consumable)) && <p className="text-[12px] text-ember-ink">Use whole numbers from {lo} to {hi}.</p>}
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
