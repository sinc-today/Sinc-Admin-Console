'use client';

import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar } from './Avatar';
import { inputClass } from './ui';

export interface SincAccount {
  id: number;
  username: string;
  name: string | null;
  email: string;
  phone: string | null;
  accountType: string | null;
  imageUrl: string | null;
  isBlocked: boolean;
  organizers: { id: number; name: string; country: string | null }[];
}

/**
 * Find an existing Sinc account by username, name, email, phone or id, and hand it to the form so the fields we
 * already know (email, name, their organizer account) are filled in. GET /accounts/lookup (staff who manage access).
 */
export function AccountPicker({ id, onPick, label = 'Find their Sinc account' }: { id: string; onPick: (a: SincAccount) => void; label?: string }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<SincAccount | null>(null);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const hits = useQuery({
    queryKey: ['account-lookup', q],
    queryFn: () => api<{ items: SincAccount[] }>(`/accounts/lookup?${new URLSearchParams({ q })}`),
    enabled: open && q.replace(/^@/, '').length >= 2,
    staleTime: 30_000,
  });
  const items = hits.data?.items ?? [];
  const pick = (a: SincAccount) => {
    setPicked(a);
    setText('');
    setOpen(false);
    onPick(a);
  };
  const showList = open && q.replace(/^@/, '').length >= 2;

  return (
    <div ref={box} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
        {label}
      </label>
      {picked ? (
        <div className="flex items-center justify-between gap-3 border border-line-strong bg-fog px-3 py-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar src={picked.imageUrl} name={picked.name || picked.username} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-ink">{picked.name || picked.username}</span>
              <span className="block truncate text-[12px] text-ink-muted">@{picked.username} · filled in below</span>
            </span>
          </span>
          <button
            type="button"
            className="shrink-0 cursor-pointer text-[13px] text-ink-secondary underline hover:text-ink"
            onClick={() => {
              setPicked(null);
              setTimeout(() => document.getElementById(id)?.focus(), 0);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && items[active] ? `${listId}-${items[active].id}` : undefined}
            autoComplete="off"
            className={`${inputClass} pl-9`}
            placeholder="Username, name, email or phone"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && showList && items[active]) {
                e.preventDefault();
                pick(items[active]);
              } else if (e.key === 'Escape' && open) {
                e.stopPropagation();
                setOpen(false);
              }
            }}
          />
        </div>
      )}
      {!picked && <p className="mt-1 text-[12px] text-ink-muted">Optional. Pick their account to fill in what Sinc already knows, or type the details yourself.</p>}
      {!picked && showList && (
        <ul id={listId} role="listbox" aria-label="Sinc accounts" className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto border border-line-strong bg-canvas py-1 shadow-lg">
          {hits.isLoading ? (
            <li className="px-3 py-2 text-[13px] text-ink-muted">Searching…</li>
          ) : hits.error ? (
            <li className="px-3 py-2 text-[13px] text-ember-ink">{(hits.error as Error).message}</li>
          ) : !items.length ? (
            <li className="px-3 py-2 text-[13px] text-ink-muted">No Sinc account matches “{q}”. Type their email below instead.</li>
          ) : (
            items.map((a, i) => (
              <li
                key={a.id}
                id={`${listId}-${a.id}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${i === active ? 'bg-fog' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(a);
                }}
              >
                <Avatar src={a.imageUrl} name={a.name || a.username} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] text-ink">
                    {a.name || a.username} <span className="text-ink-muted">@{a.username}</span>
                    {a.isBlocked && <span className="ml-1 text-[12px] text-ember-ink">blocked</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-secondary">
                    {[a.email, a.phone, a.organizers.length ? `organizer: ${a.organizers.map((o) => o.name).join(', ')}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
