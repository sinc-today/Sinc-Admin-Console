'use client';

import { List, X } from '@phosphor-icons/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMe } from '@/app/(console)/me-context';
import { Rail } from './Rail';

/**
 * Phones (below 768px): the left rail is hidden and this menu button opens the full navigation in a drawer
 * from the left. It closes on navigation, Escape, the close button or a tap outside.
 */
export function MobileNav({ partner = false }: { partner?: boolean }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);
  // Leaving phone width with the drawer open (rotating a tablet) closes it.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="-ml-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink hover:bg-fog md:hidden"
      >
        <List size={24} aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <dialog
            ref={ref}
            aria-label="Menu"
            onCancel={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
            onMouseDown={(e) => {
              if (e.target === ref.current) setOpen(false);
            }}
            className="drawer m-0 h-dvh max-h-dvh w-[min(320px,86vw)] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/40"
          >
            {open && (
              <div className="relative h-full overflow-y-auto overscroll-contain bg-ash shadow-xl" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="absolute right-3 top-4 z-10 flex size-10 cursor-pointer items-center justify-center rounded-pill text-ink-secondary hover:bg-fog hover:text-ink"
                  style={{ marginTop: 'env(safe-area-inset-top)' }}
                >
                  <X size={20} aria-hidden />
                </button>
                <Rail permissions={me.permissions} partner={partner} drawer />
              </div>
            )}
          </dialog>,
          document.body
        )}
    </>
  );
}
