'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { ListSearch, PagerBar, useSearchPager } from '@/components/pager';
import { formatRelative } from '@/lib/format';
import { ReasonDialog } from '@/components/EventActions';

interface QueueSummary {
  key: string;
  label: string;
  description: string;
  open: number | null;
  overdue: number | null;
  error?: string;
}
interface Item {
  key: string;
  subject: string;
  subtitle: string;
  createdAt: string;
  priority: 'high' | 'normal';
  facts: { label: string; value: string | number | null }[];
  links: { label: string; href: string }[];
  ageHours: number;
  overdue: boolean;
  escalated: boolean;
  escalationReason: string | null;
  assignee: { id: number; name: string; me: boolean } | null;
}
interface QueueData {
  queue: { key: string; label: string; description: string; outcomes: { key: string; label: string; needsReason: boolean }[] };
  items: Item[];
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'escalated', label: 'Escalated' },
];

const age = (h: number) => (h < 1 ? 'under 1 h' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} days`);

export default function QueuesPage() {
  const list = useQuery({ queryKey: ['queues'], queryFn: () => api<{ queues: QueueSummary[]; total: number }>('/queues') });
  const [s, setS] = useQueryStates({ q: parseAsString, filter: parseAsString, item: parseAsString });
  const queues = list.data?.queues ?? [];
  const current = s.q && queues.some((x) => x.key === s.q) ? s.q : queues[0]?.key;
  if (list.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (list.error) return <ErrorState message={(list.error as Error).message} requestId={(list.error as ApiError).requestId} onRetry={() => list.refetch()} />;
  if (!queues.length) return <EmptyState title="No queues for your role" body="Your role has no review work." />;
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Queues" className="relative -mx-1 flex gap-1 overflow-x-auto whitespace-nowrap px-1">
        {queues.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setS({ q: x.key, item: null })}
            aria-current={x.key === current ? 'page' : undefined}
            className={clsx('display inline-flex h-10 items-center gap-2 rounded-pill px-4 text-[15px]', x.key === current ? 'bg-canvas text-ink' : 'text-ink-secondary hover:bg-fog')}
          >
            {x.label}
            <span className="num text-[12px] text-ink-muted">{x.open ?? '!'}</span>
            {!!x.overdue && <span className="sr-only">, {x.overdue} overdue</span>}
          </button>
        ))}
      </nav>
      {current && <QueueView key={current} queue={current} filter={s.filter ?? 'all'} setFilter={(f) => setS({ filter: f === 'all' ? null : f, item: null })} item={s.item} setItem={(i) => setS({ item: i })} />}
    </div>
  );
}

function QueueView({ queue, filter, setFilter, item, setItem }: { queue: string; filter: string; setFilter: (f: string) => void; item: string | null; setItem: (i: string | null) => void }) {
  const q = useQuery({ queryKey: ['queue', queue, filter], queryFn: () => api<QueueData>(`/queues/${queue}?filter=${filter}`), refetchInterval: 60_000 });
  const qc = useQueryClient();
  const all = useMemo(() => q.data?.items ?? [], [q.data]);
  const { pager, q: search, setQ: setSearch } = useSearchPager(all, (i) => `${i.subject} ${i.subtitle} ${i.assignee?.name ?? ''} ${i.facts.map((f) => `${f.label} ${f.value ?? ''}`).join(' ')}`, 25);
  const items = pager.items;
  const idx = Math.max(0, items.findIndex((i) => i.key === item));
  const selected = items.length ? items[idx] : null;
  const listRef = useRef<HTMLUListElement>(null);

  const [clearing, setClearing] = useState(false);
  const clearAll = useMutation({
    mutationFn: (reason: string) => api<{ cleared: number }>(`/queues/${queue}/clear`, { method: 'POST', json: { reason, filter } }),
    meta: { success: 'Queue cleared' },
    onSuccess: () => {
      setClearing(false);
      setItem(null);
      qc.invalidateQueries({ queryKey: ['queue', queue] });
      qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });

  const assign = useMutation({
    mutationFn: (v: { key: string; to: 'me' | null }) => api(`/queues/${queue}/${encodeURIComponent(v.key)}/assign`, { method: 'POST', json: { to: v.to } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue', queue] }),
  });

  // J / K move, A assigns to me, Enter focuses the decision panel. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!items.length) return;
      if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const next = Math.min(items.length - 1, Math.max(0, idx + (e.key === 'j' ? 1 : -1)));
        setItem(items[next].key);
        listRef.current?.querySelectorAll('button')[next]?.focus();
      } else if (e.key === 'a' && selected) {
        e.preventDefault();
        assign.mutate({ key: selected.key, to: 'me' });
      } else if (e.key === 'Enter' && selected && t.tagName !== 'BUTTON') {
        document.getElementById('decision-panel')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, idx, selected, setItem, assign]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
      <Panel
        title={q.data?.queue.label}
        freshness={q.data ? `${q.data.queue.description} J and K move, A assigns to you.` : undefined}
        className="min-w-0"
        actions={
          all.length > 0 ? (
            <Button variant="quiet" onClick={() => setClearing(true)}>
              Clear all
            </Button>
          ) : undefined
        }
      >
        {clearing && (
          <ReasonDialog
            open
            onClose={() => setClearing(false)}
            title={`Clear all ${all.length} item${all.length === 1 ? '' : 's'}?`}
            description="They leave this queue for everyone. Nothing is approved, declined or changed in the app: anyone waiting stays waiting, and new items still arrive. Recorded in the audit log."
            confirm="Clear all"
            placeholder="e.g. Old test data"
            onConfirm={(r) => clearAll.mutate(r)}
            pending={clearAll.isPending}
            error={clearAll.error}
          />
        )}
        <div role="group" aria-label="Show" className="mb-3 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={clsx('h-8 rounded-tag px-3 text-[13px]', filter === f.key ? 'bg-ink text-canvas' : 'bg-fog text-ink hover:bg-line')}
            >
              {f.label}
            </button>
          ))}
        </div>
        {all.length > 0 && (
          <div className="mb-3">
            <ListSearch id={`queue-q-${queue}`} value={search} onChange={setSearch} placeholder="Name, id or detail" label="Search this queue" />
          </div>
        )}
        {q.isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : q.error ? (
          <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : !items.length ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">{search ? `Nothing matches “${search}”.` : "Nothing waiting here."}</p>
        ) : (
          <ul ref={listRef} className="-mx-4 sm:-mx-6 flex max-h-[70vh] flex-col overflow-y-auto" aria-label={`${items.length} items`}>
            {items.map((it, i) => (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => {
                    setItem(it.key);
                    // Stacked layout (phones, small tablets): bring the item's details into view.
                    if (window.matchMedia('(max-width: 1023px)').matches)
                      requestAnimationFrame(() => document.getElementById('queue-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                  }}
                  aria-current={i === idx ? 'true' : undefined}
                  className={clsx('flex w-full flex-col gap-0.5 border-b border-line px-4 py-3 sm:px-6 text-left', i === idx ? 'bg-fog' : 'hover:bg-fog')}
                >
                  <span className="flex items-center gap-2">
                    {it.priority === 'high' && <span className="text-[11px] font-medium uppercase text-ember-ink">High</span>}
                    <span className="truncate text-[14px] text-ink">{it.subject}</span>
                  </span>
                  <span className="truncate text-[12px] text-ink-secondary">{it.subtitle}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                    <span className="num">{age(it.ageHours)}</span>
                    {it.overdue && <span className="font-medium text-ember-ink">Overdue</span>}
                    {it.escalated && <span className="font-medium text-brass">Escalated</span>}
                    <span>{it.assignee ? (it.assignee.me ? 'Assigned to you' : it.assignee.name) : 'Unassigned'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <PagerBar pager={pager} noun="items" />
      </Panel>
      {selected && q.data ? (
        <div id="queue-detail" className="min-w-0 scroll-mt-16">
        <Detail queue={queue} data={q.data} item={selected} onAssign={(to) => assign.mutate({ key: selected.key, to })} assigning={assign.isPending} />
        </div>
      ) : (
        <Panel className="hidden lg:block">
          <p className="py-8 text-center text-[13px] text-ink-muted">Select an item.</p>
        </Panel>
      )}
    </div>
  );
}

function Detail({ queue, data, item, onAssign, assigning }: { queue: string; data: QueueData; item: Item; onAssign: (to: 'me' | null) => void; assigning: boolean }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    setReason('');
    setChosen(null);
  }, [item.key]);
  const history = useQuery({ queryKey: ['queue-history', queue, item.key], queryFn: () => api<{ items: { at: string; action: string; by: string | null; reason: string | null }[] }>(`/queues/${queue}/${encodeURIComponent(item.key)}/history`) });
  const decide = useMutation({
    mutationFn: (outcome: string) => api(`/queues/${queue}/${encodeURIComponent(item.key)}/decision`, { method: 'POST', json: { outcome, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue', queue] });
      qc.invalidateQueries({ queryKey: ['queues'] });
    },
  });
  const outcome = data.queue.outcomes.find((o) => o.key === chosen);
  return (
    <Panel className="flex min-w-0 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="display text-[24px] leading-tight text-ink">{item.subject}</h2>
          <p className="mt-1 text-[13px] text-ink-secondary">{item.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.priority === 'high' && <StatusBadge status="critical">High priority</StatusBadge>}
            {item.overdue && <StatusBadge status="warning">Overdue: waiting {age(item.ageHours)}</StatusBadge>}
            {item.escalated && <Tag tone="brass">Escalated{item.escalationReason ? `: ${item.escalationReason}` : ''}</Tag>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-ink-secondary">{item.assignee ? (item.assignee.me ? 'Assigned to you' : `Assigned to ${item.assignee.name}`) : 'Unassigned'}</span>
          {item.assignee?.me ? (
            <Button variant="quiet" onClick={() => onAssign(null)} loading={assigning}>
              Unassign
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onAssign('me')} loading={assigning}>
              Assign to me
            </Button>
          )}
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {item.facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[12px] font-medium text-ink-secondary">{f.label}</dt>
            <dd className="mt-0.5 break-words text-[14px] text-ink">{f.value ?? <span className="text-ink-muted">None</span>}</dd>
          </div>
        ))}
      </dl>
      {!!item.links.length && (
        <p className="mt-4 flex flex-wrap gap-4 text-[13px]">
          {item.links.map((l) => (
            <Link key={l.href} href={l.href} scroll={false} className="underline decoration-ember underline-offset-4">
              {l.label}
            </Link>
          ))}
        </p>
      )}

      <section aria-label="History" className="mt-6">
        <h3 className="text-[13px] font-medium text-ink">History</h3>
        {history.data?.items.length ? (
          <ol className="mt-2 flex flex-col gap-1 text-[12px] text-ink-secondary">
            {history.data.items.map((h, i) => (
              <li key={i}>
                {formatRelative(h.at)}: {h.action.split('.').slice(-1)[0].replace('_', ' ')} by {h.by ?? 'someone'}
                {h.reason && ` (${h.reason})`}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[12px] text-ink-muted">No earlier actions.</p>
        )}
      </section>

      <section id="decision-panel" tabIndex={-1} aria-label="Decision" className="mt-auto border-t border-line pt-4 outline-none focus-visible:ring-2 focus-visible:ring-ink">
        <div className="flex flex-wrap gap-2">
          {data.queue.outcomes.map((o, i) => (
            <Button
              key={o.key}
              variant={i === 0 ? 'primary' : 'secondary'}
              aria-pressed={chosen === o.key}
              onClick={() => (o.needsReason ? setChosen(o.key) : decide.mutate(o.key))}
              loading={decide.isPending && decide.variables === o.key}
            >
              {o.label}
            </Button>
          ))}
        </div>
        {outcome?.needsReason && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              decide.mutate(outcome.key);
            }}
          >
            <div className="min-w-[240px] flex-1">
              <Field label={`Reason for "${outcome.label}" (recorded in the audit log)`} htmlFor="q-reason">
                <input id="q-reason" required minLength={3} autoFocus className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" loading={decide.isPending}>
              {outcome.label}
            </Button>
          </form>
        )}
        {decide.error && <p className="mt-2 text-[12px] text-ember-ink">{(decide.error as Error).message}</p>}
      </section>
    </Panel>
  );
}
