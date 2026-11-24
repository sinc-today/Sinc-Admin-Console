'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowRight, BookmarkSimple, DownloadSimple, Funnel, MagnifyingGlass, Trash, X } from '@phosphor-icons/react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button, EmptyState, ErrorState, Field, InfoTip, inputClass, Skeleton, SlowNote, StatusBadge, type Status } from './ui';
import { tipFor } from '@/lib/glossary';
import { isMarketPath, marketHref } from '@/lib/market';

/* ------------------------------------------------------------------ cursor-paged list */
export function useCursorList<T extends { id: number }>(path: string, params: URLSearchParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: [path, params.toString()],
    enabled,
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(params);
      if (pageParam) qs.set('cursor', String(pageParam));
      return api<{ items: T[]; nextCursor: number | null; currency?: string }>(`${path}?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Loading / error / empty states around a list body. */
export function ListState({
  q,
  count,
  emptyTitle,
  emptyBody,
  children,
}: {
  q: { isLoading: boolean; error: unknown; refetch: () => unknown; isFetching?: boolean; isPlaceholderData?: boolean };
  count: number;
  emptyTitle: string;
  emptyBody?: string;
  children: React.ReactNode;
}) {
  if (q.isLoading)
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
        <SlowNote active />
      </div>
    );
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  if (!count) return <EmptyState title={emptyTitle} body={emptyBody} />;
  const refetching = !!q.isFetching && !!q.isPlaceholderData;
  return (
    <div className={clsx('relative transition-opacity duration-150', refetching && 'opacity-60')} aria-busy={refetching || undefined}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ table primitives */
type Head = string | { label: string; align?: 'right'; tip?: string };

/**
 * Data table. Headers whose label is in the glossary get an "i" tooltip. `sticky` keeps the header in view
 * by scrolling the table body itself (use it for long lists). `caption` holds values shared by every row.
 */
/**
 * Clicking anywhere on a row follows its main link (the RowLink marked data-row-link), unless the click was on
 * another control or the person is selecting text. Cmd/Ctrl-click opens it in a new tab. Keyboard users keep
 * using the link itself.
 */
export const openRow = (e: React.MouseEvent<HTMLTableSectionElement>) => {
  const t = e.target as HTMLElement;
  if (t.closest('a, button, input, select, textarea, label, summary, dialog, [role="button"], [role="switch"], [role="dialog"]')) return;
  if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
  const tr = t.closest('tr');
  const link = tr?.querySelector<HTMLAnchorElement>('a[data-row-open]') ?? tr?.querySelector<HTMLAnchorElement>('a[data-row-link]');
  if (!link) return;
  if (e.metaKey || e.ctrlKey) window.open(link.href, '_blank', 'noopener');
  else link.click();
};

export function Table({ minWidth = 880, head, children, sticky, caption }: { minWidth?: number; head: Head[]; children: React.ReactNode; sticky?: boolean; caption?: React.ReactNode }) {
  return (
    <>
      {caption && <p className="-mt-1 mb-2 text-[12px] text-ink-muted">{caption}</p>}
      <div className={clsx('relative -mx-6 overflow-x-auto', sticky && 'max-h-[min(70dvh,900px)] overflow-y-auto')}>
        <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
          <thead className={clsx(sticky && 'sticky top-0 z-10')}>
            <tr className="bg-fog text-left text-[12px] text-ink-secondary">
              {head.map((h, i) => {
                const label = typeof h === 'string' ? h : h.label;
                const right = typeof h !== 'string' && h.align === 'right';
                const tip = (typeof h !== 'string' && h.tip) || tipFor(label);
                return (
                  <th key={label + i} scope="col" className={clsx('h-10 whitespace-nowrap font-medium', i === 0 ? 'pl-6 pr-4' : i === head.length - 1 ? 'pl-4 pr-6' : 'px-4', right && 'text-right')}>
                    <span className={clsx('inline-flex items-center gap-1', right && 'flex-row-reverse')}>
                      {label}
                      {tip && <InfoTip label={`About ${label}`}>{tip}</InfoTip>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody onClick={openRow}>{children}</tbody>
        </table>
      </div>
    </>
  );
}

export const tdFirst = 'pl-6 pr-4';
export const td = 'px-4';
export const tdLast = 'pl-4 pr-6';

export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  const target = isMarketPath(pathname) ? marketHref(href, search) : href;
  if (!target) return <span className="text-ink">{children}</span>;
  return (
    <Link href={target} data-row-link="" className="text-ink underline decoration-ember underline-offset-4 hover:decoration-2 hover:text-ember-ink">
      {children}
    </Link>
  );
}

/**
 * The last cell of a clickable row: an explicit "Open" button for the row's page. Clicking anywhere else on the
 * row does the same (see openRow). In market mode it follows the market page, or stays empty for Sinc-only pages.
 */
export function OpenCell({ href, name, label = 'Open' }: { href: string; name?: string; label?: string }) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  const target = isMarketPath(pathname) ? marketHref(href, search) : href;
  return (
    <td className={`${tdLast} w-[1%] whitespace-nowrap text-right`}>
      {target && (
        <Link
          href={target}
          data-row-open=""
          aria-label={name ? `${label} ${name}` : label}
          className="inline-flex h-8 items-center gap-1 rounded-pill px-3 text-[13px] text-ink ring-1 ring-line-strong hover:bg-ink hover:text-canvas hover:ring-ink"
        >
          {label}
          <ArrowRight size={13} aria-hidden />
        </Link>
      )}
    </td>
  );
}

/* ------------------------------------------------------------------ small facts */
export function Facts({ items, cols = 4 }: { items: { label: string; value: React.ReactNode; hint?: string }[]; cols?: 2 | 3 | 4 | 6 }) {
  return (
    <dl className={clsx('grid grid-cols-2 gap-x-6 gap-y-5', cols === 3 && 'md:grid-cols-3', cols === 4 && 'md:grid-cols-4', cols === 6 && 'md:grid-cols-3 xl:grid-cols-6')}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
            {it.label}
            {(it.hint ?? tipFor(it.label)) && <InfoTip label={`About ${it.label}`}>{it.hint ?? tipFor(it.label)}</InfoTip>}
          </dt>
          <dd className="num mt-1 truncate text-[16px] text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BigNumber({ label, value, sub, tip }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tip?: string }) {
  const t = tip ?? tipFor(label);
  return (
    <div className="flex min-h-[104px] flex-col rounded-panel bg-canvas p-4 sm:min-h-[112px] sm:p-5">
      <p className="flex items-center gap-1 text-[12px] font-medium text-ink-secondary">
        {label}
        {t && <InfoTip label={`About ${label}`}>{t}</InfoTip>}
      </p>
      <p className="display num mt-2 truncate text-[24px] leading-[1.19] text-ink sm:text-[32px]" title={typeof value === 'string' ? value : undefined}>{value}</p>
      {sub && <p className="mt-1 text-[12px] text-ink-muted">{sub}</p>}
    </div>
  );
}

/** ISO 3166 alpha-2 shown as text, never as an emoji flag. */
export function CountryCode({ code, name }: { code: string | null | undefined; name?: string | null }) {
  if (!code || code === 'XX') return <span className="text-ink-muted">Unknown</span>;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="num inline-flex h-5 min-w-7 items-center justify-center rounded-tag bg-fog px-1.5 text-[11px] font-medium text-ink">{code}</span>
      {name && <span className="truncate">{name}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ filters bar helpers */
export function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** One search box: searches as you type (300 ms pause) or on Enter. A clear button appears once there is text. */
export function SearchForm({ id, label, helper, placeholder, initial, onSearch }: { id: string; label: string; helper?: string; placeholder?: string; initial: string; onSearch: (v: string | null) => void }) {
  const [v, setV] = useState(initial);
  const last = useRef(initial);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = v.trim();
      if (next === last.current) return;
      if (next.length === 1) return; // wait for a second character
      last.current = next;
      onSearch(next || null);
    }, 300);
    return () => clearTimeout(t);
  }, [v, onSearch]);
  return (
    <form
      role="search"
      className="relative w-full max-w-[480px]"
      onSubmit={(e) => {
        e.preventDefault();
        last.current = v.trim();
        onSearch(v.trim() || null);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MagnifyingGlass size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        id={id}
        type="search"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className={clsx(inputClass, 'pl-9 pr-9')}
        placeholder={placeholder ?? label}
        title={helper}
        autoComplete="off"
      />
      {v && (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-ink-muted hover:text-ink"
          onClick={() => {
            setV('');
            last.current = '';
            onSearch(null);
          }}
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </form>
  );
}

/** Filters behind one button; active ones show as removable chips. */
export function FilterBar({
  search,
  filters,
  active,
  onClearAll,
  actions,
}: {
  search: React.ReactNode;
  filters: React.ReactNode;
  active: { key: string; label: string; onRemove: () => void }[];
  onClearAll?: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {search}
        <Popover.Root>
          <Popover.Trigger className="inline-flex h-10 items-center gap-2 bg-canvas px-3 text-[13px] font-medium text-ink outline outline-1 outline-line-strong hover:bg-fog">
            <Funnel size={16} aria-hidden /> Filters{active.length ? ` (${active.length})` : ''}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={8} className="z-50 grid w-[min(92vw,560px)] grid-cols-1 gap-4 border border-line-strong bg-canvas p-4 sm:grid-cols-2" style={{ borderRadius: 0 }}>
              {filters}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => (onClearAll ? onClearAll() : active.forEach((f) => f.onRemove()))}
            className="inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium text-ink-secondary hover:bg-fog hover:text-ink"
          >
            <X size={14} aria-hidden /> Clear filters
          </button>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {active.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {active.map((f) => (
            <li key={f.key}>
              <button type="button" onClick={f.onRemove} className="inline-flex h-7 items-center gap-1.5 rounded-tag bg-canvas px-2.5 text-[12px] text-ink hover:bg-fog" aria-label={`Remove filter ${f.label}`}>
                {f.label} <X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ CSV export */
export function ExportButton({ path, params, label = 'Export CSV' }: { path: string; params: URLSearchParams; label?: string }) {
  return (
    <a
      href={`/admin-api/v1${path}?${params}`}
      className="inline-flex h-10 items-center gap-2 bg-canvas px-3 text-[13px] font-medium text-ink outline outline-1 outline-line-strong hover:bg-fog"
      title="Download a CSV of these filters (recorded in the audit log)"
    >
      <DownloadSimple size={16} aria-hidden /> {label}
    </a>
  );
}

/* ------------------------------------------------------------------ saved views */
interface SavedView {
  id: number;
  page: string;
  name: string;
  query: string;
  shared: boolean;
  mine: boolean;
}

/** Saved filter sets for a page. Search text is never saved, only filters. */
export function SavedViews({ page }: { page: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const list = useQuery({ queryKey: ['saved-views', page], queryFn: () => api<{ items: SavedView[] }>(`/saved-views?page=${page}`) });
  const save = useMutation({
    mutationFn: () => api<SavedView>('/saved-views', { method: 'POST', json: { page, name, query: sp.toString(), shared } }),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['saved-views', page] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/saved-views/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', page] }),
  });
  const items = list.data?.items ?? [];
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex h-10 items-center gap-2 bg-canvas px-3 text-[13px] font-medium text-ink outline outline-1 outline-line-strong hover:bg-fog">
        <BookmarkSimple size={16} aria-hidden /> Views{items.length ? ` (${items.length})` : ''}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-80 border border-line-strong bg-canvas p-4" style={{ borderRadius: 0 }}>
          <p className="display text-[16px] text-ink">Saved views</p>
          {items.length === 0 ? (
            <p className="mt-2 text-[13px] text-ink-muted">No saved views for this page yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {items.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 border-b border-line py-2">
                  <button type="button" className="min-w-0 truncate text-left text-[13px] text-ink hover:underline hover:decoration-ember hover:underline-offset-4" onClick={() => router.push(`${pathname}?${v.query}`)}>
                    {v.name}
                    {v.shared && <span className="ml-2 text-[12px] text-ink-muted">shared</span>}
                  </button>
                  {v.mine && (
                    <button type="button" aria-label={`Delete view ${v.name}`} className="text-ink-muted hover:text-ink" onClick={() => remove.mutate(v.id)}>
                      <Trash size={16} aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate();
            }}
          >
            <Field label="Save current filters as" htmlFor={`sv-${page}`} helper="The date range and filters are saved. Search text is not.">
              <input id={`sv-${page}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with all staff
            </label>
            <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
              Save view
            </Button>
            {save.error && <p className="text-[12px] text-ember-ink">{(save.error as Error).message}</p>}
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export const dayFmt = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Kigali' }).format(new Date(iso)) : 'Never';

export const verificationBadge = (v: string | null) => {
  const map: Record<string, [Status, string]> = { APPROVED: ['ok', 'Approved'], PENDING: ['pending', 'Pending'], DECLINED: ['critical', 'Declined'] };
  const [s, l] = map[v ?? ''] ?? ['info', 'Not submitted'];
  return <StatusBadge status={s}>{l}</StatusBadge>;
};

/** Active-filter chips from select options: one chip per set filter. */
export function chipsFor(
  defs: { key: string; label: string; options: { value: string; label: string }[] }[],
  values: Record<string, string | null | undefined>,
  clear: (key: string) => void
) {
  return defs
    .filter((d) => values[d.key])
    .map((d) => ({ key: d.key, label: `${d.label}: ${d.options.find((o) => o.value === values[d.key])?.label ?? values[d.key]}`, onRemove: () => clear(d.key) }));
}
