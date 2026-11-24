'use client';

import { X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A centred popup built on the native <dialog>: focus stays inside, Escape closes it, and so does a click
 * on the backdrop.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  width = 'max-w-[860px]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Rendered at the end of <body> so a dialog opened from a table cell or a link doesn't inherit its styles.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);

  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[calc(100vw-32px)] text-left font-normal ${width} max-h-[calc(100dvh-32px)] overflow-visible bg-transparent p-0 backdrop:bg-black/40`}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-32px)] flex-col border border-line-strong bg-canvas">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <h2 id="modal-title" className="display text-[22px] leading-tight text-ink">
                {title}
              </h2>
              {description && <p className="mt-1 text-[13px] text-ink-secondary">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 shrink-0 items-center justify-center text-ink-secondary hover:bg-fog hover:text-ink">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>,
    document.body
  );
}
