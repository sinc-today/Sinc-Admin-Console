'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button, Field, inputClass } from '@/components/ui';
import { api } from '@/lib/api';

/** Changes the Sinc account password (the same one used in the app). */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [done, setDone] = useState(false);
  const mismatch = f.confirm.length > 0 && f.confirm !== f.newPassword;
  const m = useMutation({
    meta: { success: 'Password changed' },
    mutationFn: () => api('/auth/password', { method: 'POST', json: { oldPassword: f.oldPassword, newPassword: f.newPassword } }),
    onSuccess: () => {
      setDone(true);
      setF({ oldPassword: '', newPassword: '', confirm: '' });
    },
  });
  const close = () => {
    setDone(false);
    m.reset();
    setF({ oldPassword: '', newPassword: '', confirm: '' });
    onClose();
  };
  return (
    <Modal open={open} onClose={close} title="Change password" description="This is your Sinc account password, the same one you use in the Sinc app." width="max-w-[480px]">
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-[14px] text-ink">
            Password changed. Use the new one next time you sign in here or in the app.
          </p>
          <div>
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch) m.mutate();
          }}
        >
          <Field label="Current password" htmlFor="cp-old">
            <input id="cp-old" type="password" autoComplete="current-password" required className={inputClass} value={f.oldPassword} onChange={(e) => setF({ ...f, oldPassword: e.target.value })} />
          </Field>
          <Field label="New password" htmlFor="cp-new" helper="At least 8 characters, starting with a letter or digit, with a letter, a digit and one of @ # $ % ^ & ! _">
            <input id="cp-new" type="password" autoComplete="new-password" required minLength={8} className={inputClass} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
          </Field>
          <Field label="New password again" htmlFor="cp-confirm" error={mismatch ? "The passwords don't match" : undefined}>
            <input id="cp-confirm" type="password" autoComplete="new-password" required aria-invalid={mismatch} className={inputClass} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} disabled={mismatch}>
              Change password
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
