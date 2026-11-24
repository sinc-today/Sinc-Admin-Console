'use client';

import { CheckCircle } from '@phosphor-icons/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Toast = { id: number; text: string };
const Ctx = createContext<(text: string) => void>(() => undefined);

/** Push a short success message (max 6 words). */
export const useToast = () => useContext(Ctx);

let external: ((text: string) => void) | null = null;
/** For code outside React (the query client's mutation cache). */
export const toast = (text: string) => external?.(text);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string) => {
    const id = next.current++;
    setItems((xs) => [...xs.filter((x) => x.text !== text), { id, text }].slice(-3));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);
  useEffect(() => {
    external = push;
    return () => {
      external = null;
    };
  }, [push]);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <p key={t.id} className="toast-in flex items-center gap-2 bg-ink px-4 py-2.5 text-[14px] text-canvas shadow-md">
            <CheckCircle size={16} aria-hidden /> {t.text}
          </p>
        ))}
      </div>
    </Ctx.Provider>
  );
}
