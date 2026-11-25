'use client';

import { CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { inputClass } from './ui';

export const PAGE_SIZES = [25, 50, 100] as const;

export interface Pager<T> {
  items: T[];
  page: number;
  size: number;
  setSize: (n: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
  next: () => void;
  prev: () => void;
  total?: number | null;
  isLoading: boolean;
  isFetching: boolean;
  isPlaceholderData?: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Page size: in the URL (`size`) for a page's main list so a shared link opens the same view;
 * local state for sub-lists so two lists on one page don't fight over one parameter.
 */
const usePageSize = (inUrl: boolean, initial: number) => {
  const [urlSize, setUrlSize] = useQueryState('size', parseAsInteger.withDefault(initial));
  const [local, setLocal] = useState(initial);
  return inUrl ? ([urlSize, (n: number) => void setUrlSize(n === initial ? null : n)] as const) : ([local, setLocal] as const);
};

/**
 * Server cursor paging (`?cursor=&limit=` → `{ items, nextCursor }`). The cursors already visited are
 * kept in a stack so Previous works; any change to the filters goes back to page 1.
 */
export function useCursorPager<T>(path: string, params: URLSearchParams, opts: { enabled?: boolean; urlSize?: boolean; initialSize?: number } = {}): Pager<T> & { data?: Record<string, unknown> } {
  const [size, setSize] = usePageSize(opts.urlSize ?? true, opts.initialSize ?? 25);
  const base = params.toString();
  const [stack, setStack] = useState<(number | string | null)[]>([null]);
  useEffect(() => setStack([null]), [path, base, size]);
  const cursor = stack[stack.length - 1];
  const q = useQuery({
    queryKey: [path, base, size, cursor],
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const qs = new URLSearchParams(params);
      qs.set('limit', String(size));
      if (cursor !== null && cursor !== undefined) qs.set('cursor', String(cursor));
      return api<{ items: T[]; nextCursor: number | string | null; total?: number }>(`${path}?${qs}`);
    },
  });
  const nextCursor = q.data?.nextCursor ?? null;
  return {
    data: q.data as Record<string, unknown> | undefined,
    items: q.data?.items ?? [],
    page: stack.length,
    size,
    setSize,
    hasNext: nextCursor !== null,
    hasPrev: stack.length > 1,
    next: () => nextCursor !== null && setStack((s) => [...s, nextCursor]),
    prev: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    total: q.data?.total ?? null,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isPlaceholderData: q.isPlaceholderData,
    error: q.error,
    refetch: q.refetch,
  };
}

/** Page-number paging for small or ranked lists (`?page=&limit=`). `select` maps the response. */
export function useOffsetPager<T, R>(
  path: string,
  params: URLSearchParams,
  select: (r: R) => { items: T[]; hasMore?: boolean; total?: number | null },
  opts: { enabled?: boolean; urlSize?: boolean; initialSize?: number; refetchMs?: number } = {}
): Pager<T> & { data?: R } {
  const [size, setSize] = usePageSize(opts.urlSize ?? false, opts.initialSize ?? 25);
  const base = params.toString();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [path, base, size]);
  const q = useQuery({
    queryKey: [path, base, size, page],
    enabled: opts.enabled ?? true,
    placeholderData: keepPreviousData,
    refetchInterval: opts.refetchMs,
    queryFn: () => {
      const qs = new URLSearchParams(params);
      qs.set('limit', String(size));
      qs.set('page', String(page));
      return api<R>(`${path}?${qs}`);
    },
  });
  const sel = q.data ? select(q.data) : null;
  const total = sel?.total ?? null;
  const hasNext = sel ? (sel.hasMore ?? (total !== null ? page * size < total : false)) : false;
  return {
    data: q.data,
    items: sel?.items ?? [],
    page,
    size,
    setSize,
    hasNext,
    hasPrev: page > 1,
    next: () => hasNext && setPage((p) => p + 1),
    prev: () => setPage((p) => Math.max(1, p - 1)),
    total,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isPlaceholderData: q.isPlaceholderData,
    error: q.error,
    refetch: q.refetch,
  };
}

/** Paging over an array already in memory (staff, small lists). */
export function useClientPager<T>(all: T[], initialSize = 25): Pager<T> {
  const [size, setSize] = useState(initialSize);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [all.length, size]);
  const items = useMemo(() => all.slice((page - 1) * size, page * size), [all, page, size]);
  return {
    items,
    page,
    size,
    setSize,
    hasNext: page * size < all.length,
    hasPrev: page > 1,
    next: () => setPage((p) => (p * size < all.length ? p + 1 : p)),
    prev: () => setPage((p) => Math.max(1, p - 1)),
    total: all.length,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: () => undefined,
  };
}

/** "Showing 51–100 of 230 · Rows [50] · ‹ ›" — sits under a list. */
export function PagerBar<T>({ pager, noun = 'rows', sizes = PAGE_SIZES as unknown as number[] }: { pager: Pager<T>; noun?: string; sizes?: number[] }) {
  const { page, size, items, total, hasNext, hasPrev, isFetching } = pager;
  if (!items.length && page === 1) return null;
  const from = (page - 1) * size + 1;
  const to = from + items.length - 1;
  const btn = 'inline-flex size-11 sm:size-9 items-center justify-center text-ink outline outline-1 outline-line-strong hover:bg-fog disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent';
  return (
    <nav aria-label={`Pages of ${noun}`} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-secondary">
      <p className="num" aria-live="polite">
        Showing {from.toLocaleString('en')}–{to.toLocaleString('en')}
        {total !== null && total !== undefined ? ` of ${total.toLocaleString('en')}` : ''} {noun}
        {isFetching && <span className="ml-2 text-ink-muted">Loading…</span>}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span>Per page</span>
          <select value={size} onChange={(e) => pager.setSize(Number(e.target.value))} className="h-9 border border-line-strong bg-canvas px-2 text-ink" aria-label={`${noun} per page`}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <span className="num">Page {page}</span>
        <button type="button" className={btn} onClick={pager.prev} disabled={!hasPrev} aria-label="Previous page">
          <CaretLeft size={16} aria-hidden />
        </button>
        <button type="button" className={btn} onClick={pager.next} disabled={!hasNext} aria-label="Next page">
          <CaretRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Search + pages over a list already in memory: every word typed must appear in the row's text
 * (case and accents ignored). Use with <ListSearch> and <PagerBar>.
 */
export function useSearchPager<T>(all: T[], text: (row: T) => string, initialSize = 25) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return all;
    return all.filter((row) => {
      const t = norm(text(row));
      return words.every((w) => t.includes(w));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q]);
  const pager = useClientPager(filtered, initialSize);
  return { pager, q, setQ, matched: filtered.length, total: all.length };
}

/** The search box for useSearchPager lists. */
export function ListSearch({ id, value, onChange, placeholder = 'Search', label = 'Search this list', className }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; label?: string; className?: string }) {
  return (
    <div role="search" className={`relative w-full max-w-[360px] ${className ?? ''}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputClass} pl-9`}
        autoComplete="off"
      />
    </div>
  );
}
