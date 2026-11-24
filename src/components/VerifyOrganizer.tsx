'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { Modal } from './Modal';
import { Button, Field, inputClass } from './ui';
import { api } from '@/lib/api';
import { DocumentPicker, documentProblem, uploadDocument } from './OrganizerDocuments';

/**
 * Manual verification of an organizer (the verified badge), whether or not they asked for it.
 * Withdrawals are a separate switch.
 */
export function VerifyOrganizerButtons({ organizerId, verification }: { organizerId: number; verification: string | null }) {
  const can = useCan('organizers.verify');
  const qc = useQueryClient();
  const [action, setAction] = useState<'APPROVED' | 'DECLINED' | null>(null);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'save' | null>(null);
  const m = useMutation({
    meta: { success: 'Verification updated' },
    mutationFn: async () => {
      // The optional company document goes up first, then the decision refers to it.
      let documentId: number | undefined;
      if (file && action === 'APPROVED') {
        setStep('upload');
        documentId = (await uploadDocument(organizerId, file)).id;
      }
      setStep('save');
      return api(`/organizers/${organizerId}/verification`, { method: 'PATCH', json: { status: action, reason, ...(documentId ? { documentId } : {}) } });
    },
    onSettled: () => setStep(null),
    onSuccess: () => {
      setAction(null);
      setReason('');
      setFile(null);
      qc.invalidateQueries({ queryKey: ['organizer'] });
      qc.invalidateQueries({ queryKey: ['organizer-docs'] });
      qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });
  if (!can) return null;
  const approved = verification === 'APPROVED';
  return (
    <>
      {!approved && <Button onClick={() => setAction('APPROVED')}>Verify organizer</Button>}
      {approved && (
        <Button variant="secondary" onClick={() => setAction('DECLINED')}>
          Remove verification
        </Button>
      )}
      {verification === 'PENDING' && (
        <Button variant="secondary" onClick={() => setAction('DECLINED')}>
          Decline request
        </Button>
      )}
      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action === 'APPROVED' ? 'Verify this organizer' : approved ? 'Remove verification' : 'Decline verification'}
        description={
          action === 'APPROVED'
            ? 'The organizer gets the verified badge in the app and is notified. This does not allow withdrawals; use the withdrawals switch for that.'
            : 'The verified badge is removed and the organizer is notified. Withdrawals are not changed.'
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
          <Field label="Reason (recorded in the audit log)" htmlFor="vo-reason">
            <input id="vo-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === 'APPROVED' ? 'e.g. Business registration checked' : 'e.g. Documents could not be confirmed'} />
          </Field>
          {action === 'APPROVED' && <DocumentPicker file={file} onChange={setFile} id="vo-doc" />}
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} loadingText={step === 'upload' ? 'Uploading…' : 'Saving…'} disabled={action === 'APPROVED' && !!documentProblem(file)}>
              {action === 'APPROVED' ? 'Verify' : approved ? 'Remove verification' : 'Decline'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
