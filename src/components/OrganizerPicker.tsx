'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { inputClass } from '@/components/ui';

interface Hit {
  id: number;
  name: string;
  username: string | null;
  country: string | null;
  verification: string | null;
  events: number;
}

const COUNTRY: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda' };

/**
 * Search organizer profiles by name, username or #id and pick one. `value` is the organizer profile id as a
 * string ('' = none). Uses GET /organizers?q=, so the person needs organizers.read.
 */
export function OrganizerPicker({
  id,
  value,
  onChange,
  initialLabel,
  placeholder = 'Search by name, @username or #id',
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  initialLabel?: string | null;
  placeholder?: string;
}) {
  const [label, setLabel] = useState<string | null>(value ? initialLabel || `Organizer #${value}` : null);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim().replace(/^[#@]/, '')), 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    if (!value) setLabel(null);
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const hits = useQuery({
    queryKey: ['organizer-search', q],
    queryFn: () => api<{ items: Hit[] }>(`/organizers?${new URLSearchParams({ q, limit: '8' })}`),
    enabled: open && q.length >= 2,
    staleTime: 30_000,
  });
  const items = hits.data?.items ?? [];

  const pick = (h: Hit) => {
    onChange(String(h.id));
    setLabel(`${h.name} (#${h.id})`);
    setText('');
    setOpen(false);
  };

  if (value && label) {
    return (
      <div className={`${inputClass} flex items-center justify-between gap-2`}>
        <span className="truncate">{label}</span>
        <button
          type="button"
          className="shrink-0 text-[13px] text-ink-secondary underline hover:text-ink"
          onClick={() => {
            onChange('');
            setLabel(null);
            setTimeout(() => document.getElementById(id)?.focus(), 0);
          }}
          aria-label={`Change organizer, currently ${label}`}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open && q.length >= 2}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
        autoComplete="off"
        className={inputClass}
        placeholder={placeholder}
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
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(items.length - 1, 0)));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && items[active]) {
            e.preventDefault();
            pick(items[active]);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && q.length >= 2 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto border border-line-strong bg-canvas py-1 shadow-lg">
          {hits.isLoading ? (
            <li className="px-3 py-2 text-[13px] text-ink-muted">Searching…</li>
          ) : hits.error ? (
            <li className="px-3 py-2 text-[13px] text-ember-ink">{(hits.error as Error).message}</li>
          ) : !items.length ? (
            <li className="px-3 py-2 text-[13px] text-ink-muted">No organizer matches “{q}”.</li>
          ) : (
            items.map((h, i) => (
              <li
                key={h.id}
                id={`${listId}-${h.id}`}
                role="option"
                aria-selected={i === active}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-fog' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
              >
                <span className="block text-[14px] text-ink">
                  {h.name} <span className="text-ink-muted">#{h.id}</span>
                </span>
                <span className="block text-[12px] text-ink-secondary">
                  {[h.username && `@${h.username}`, h.country && (COUNTRY[h.country] ?? h.country), `${h.events} ${h.events === 1 ? 'event' : 'events'}`, h.verification === 'APPROVED' ? 'verified' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
