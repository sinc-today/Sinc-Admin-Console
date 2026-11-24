'use client';

import { useEffect, useRef } from 'react';

/**
 * Right-hand side pane on a native modal <dialog>: focus is trapped, Esc closes it, and so does a
 * click outside the pane (on the dimmed page). A press that starts inside and ends outside
 * (selecting text, say) does not close it.
 */
export function SidePane({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={label}
      onPointerDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) ref.current?.close();
        downOnBackdrop.current = false;
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-[min(560px,100vw)] max-w-none overflow-y-auto bg-ash p-0 text-ink backdrop:bg-[rgba(20,20,20,0.32)]"
    >
      {open && children}
    </dialog>
  );
}
