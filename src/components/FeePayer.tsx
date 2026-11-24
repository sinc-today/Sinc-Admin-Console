'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, inputClass, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '@/app/(console)/me-context';

export type FeePayer = 'ORGANIZER' | 'BUYER';

const LABEL: Record<FeePayer, string> = {
  ORGANIZER: 'Organizer pays: Sinc’s fee comes out of the ticket price',
  BUYER: 'Buyer pays: Sinc’s fee is added on top of the ticket price',
};

/** Who pays Sinc's commission on an event's tickets. Staff with events.manage can change it. */
export function FeePayerPanel({ eventId, value }: { eventId: number; value: FeePayer }) {
  const canManage = useCan('events.manage');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<{ feePayer: FeePayer; reason: string }>({ feePayer: value, reason: '' });
  const save = useMutation({
    meta: { success: 'Service fee updated' },
    mutationFn: () => api(`/events/${eventId}/fee-payer`, { method: 'PATCH', json: f }),
    onSuccess: () => {
      setEditing(false);
      setF((x) => ({ ...x, reason: '' }));
      qc.invalidateQueries({ queryKey: ['event'] });
    },
  });
  return (
    <Panel
      title="Service fee"
      freshness="Changes apply to tickets reserved from now on. Tickets already paid for keep the split they were bought with."
      actions={
        canManage && !editing ? (
          <Button variant="quiet" onClick={() => setEditing(true)}>
            Change
          </Button>
        ) : undefined
      }
    >
      {!editing ? (
        <p className="text-[14px] text-ink">{LABEL[value]}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Who pays Sinc’s fee</legend>
            {(['ORGANIZER', 'BUYER'] as FeePayer[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-[14px]">
                <input type="radio" name={`fee-payer-${eventId}`} checked={f.feePayer === k} onChange={() => setF({ ...f, feePayer: k })} /> {LABEL[k]}
              </label>
            ))}
          </fieldset>
          <Field label="Reason (recorded in the audit log)" htmlFor={`fp-reason-${eventId}`}>
            <input id={`fp-reason-${eventId}`} required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Organizer asked for all-in pricing" />
          </Field>
          {save.error && <p className="text-[12px] text-ember-ink">{(save.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending} disabled={f.feePayer === value}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
