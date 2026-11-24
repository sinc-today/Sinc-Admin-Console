'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Field, inputClass, Panel } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '@/app/(console)/me-context';
import { EventPrivacyButton, FeatureEventButton } from './EventActions';

export type FeePayer = 'ORGANIZER' | 'BUYER';

const SHORT: Record<FeePayer, string> = { ORGANIZER: 'Organizer', BUYER: 'Buyer (client)' };
const LABEL: Record<FeePayer, string> = {
  ORGANIZER: 'Organizer pays: Sinc’s commission comes out of the ticket price',
  BUYER: 'Buyer pays: Sinc’s commission is added on top of the ticket price at checkout',
};

function Row({ label, value, note, action }: { label: string; value: React.ReactNode; note?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-secondary">{label}</p>
        <p className="mt-0.5 text-[14px] text-ink">{value}</p>
        {note && <p className="mt-0.5 text-[12px] text-ink-muted">{note}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Event settings staff can change on the organizer's behalf (events.manage): who pays Sinc's commission,
 * visibility, and whether the app features it. Every change asks for a reason and is audited.
 */
export function EventSettingsPanel({ eventId, feePayer, privacy, featured }: { eventId: number; feePayer: FeePayer; privacy: string | null; featured: boolean }) {
  const canManage = useCan('events.manage');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<{ feePayer: FeePayer; reason: string }>({ feePayer, reason: '' });
  const save = useMutation({
    meta: { success: 'Commission setting updated' },
    mutationFn: () => api(`/events/${eventId}/fee-payer`, { method: 'PATCH', json: f }),
    onSuccess: () => {
      setEditing(false);
      setF((x) => ({ ...x, reason: '' }));
      qc.invalidateQueries({ queryKey: ['event'] });
    },
  });
  return (
    <Panel title="Event settings" info="Changes made here apply right away and are recorded in the audit log with your reason.">
      <div>
        <Row
          label="Commission paid by"
          value={SHORT[feePayer]}
          note={`${LABEL[feePayer]}. Applies to tickets reserved from now on; tickets already paid keep their split.`}
          action={
            canManage && !editing ? (
              <Button variant="secondary" onClick={() => { setF({ feePayer, reason: '' }); setEditing(true); }}>
                Change
              </Button>
            ) : undefined
          }
        />
        {editing && (
          <form
            className="mb-4 flex flex-col gap-4 border border-line-strong p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Who pays Sinc’s commission</legend>
              {(['ORGANIZER', 'BUYER'] as FeePayer[]).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-[14px]">
                  <input type="radio" name={`fee-payer-${eventId}`} checked={f.feePayer === k} onChange={() => setF({ ...f, feePayer: k })} /> {LABEL[k]}
                </label>
              ))}
            </fieldset>
            <Field label="Reason (recorded in the audit log)" htmlFor={`fp-reason-${eventId}`}>
              <input id={`fp-reason-${eventId}`} required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Organizer asked for all-in pricing" />
            </Field>
            {save.error && <p className="text-[12px] text-ember-ink">{(save.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button type="submit" loading={save.isPending} disabled={f.feePayer === feePayer || f.reason.trim().length < 5}>
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        <Row
          label="Visibility"
          value={privacy === 'PRIVATE' ? 'Private' : 'Public'}
          note={privacy === 'PRIVATE' ? 'Hidden from the feed and search. People with the link and ticket holders keep access.' : 'Shown in the feed and search. Anyone can find it and buy tickets.'}
          action={<EventPrivacyButton eventId={eventId} privacy={privacy} />}
        />
        <Row
          label="Featured in the app"
          value={featured ? 'Yes' : 'No'}
          note={featured ? 'Shown in the app’s featured list.' : 'Not in the featured list. Private events are never featured.'}
          action={<FeatureEventButton eventId={eventId} featured={featured} />}
        />
      </div>
    </Panel>
  );
}
