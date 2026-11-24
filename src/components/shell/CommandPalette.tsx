'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMe } from '@/app/(console)/me-context';
import { api } from '@/lib/api';
import { ALL_NAV_ITEMS } from '@/lib/nav';

interface Group {
  kind: string;
  label: string;
  items: { id: number | string; title: string; subtitle?: string | null; href: string }[];
}

/** ⌘K / Ctrl+K: jump to a page, or find a user, organizer, event or transaction (only kinds you can see). */
export function CommandPalette() {
  const router = useRouter();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(t);
  }, [term]);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api<{ groups: Group[] }>(`/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });
  const pages = ALL_NAV_ITEMS.filter((i) => i.phase === 0 && (!i.permission || me.permissions.includes(i.permission)));
  const go = (href: string) => {
    setOpen(false);
    setTerm('');
    router.push(href);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 px-3 text-[13px] text-ink-secondary hover:text-ink" aria-label="Search (Command K)">
        <MagnifyingGlass size={18} aria-hidden />
        <span className="hidden xl:inline">Search</span>
        <kbd className="hidden border border-line-strong px-1.5 text-[12px] xl:inline">⌘K</kbd>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search the console"
        shouldFilter={false}
        overlayClassName="fixed inset-0 z-40 bg-[rgba(20,20,20,0.24)]"
        contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 border border-line-strong bg-canvas"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <MagnifyingGlass size={18} aria-hidden className="text-ink-muted" />
          <Command.Input value={term} onValueChange={setTerm} placeholder="Find a user, organizer, event or transaction id" className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-muted" />
        </div>
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          {debounced.length >= 2 && results.isFetching && !results.data && <Command.Loading>
            <p className="px-3 py-2 text-[13px] text-ink-muted">Searching…</p>
          </Command.Loading>}
          {debounced.length >= 2 && results.data && results.data.groups.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-ink-muted">Nothing found for “{debounced}”. Ids match exactly; names match from the start.</p>
          )}
          {debounced.length >= 2 &&
            results.data?.groups.map((g) => (
              <Command.Group key={g.kind} heading={g.label} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-secondary">
                {g.items.map((it) => (
                  <Command.Item key={`${g.kind}-${it.id}`} value={`${g.kind}-${it.id}`} onSelect={() => go(it.href)} className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[13px] data-[selected=true]:bg-fog">
                    <span className="truncate text-ink">{it.title}</span>
                    {it.subtitle && <span className="shrink-0 text-[12px] text-ink-muted">{it.subtitle}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          {debounced.length < 2 && (
            <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-secondary">
              {pages
                .filter((p) => !term || p.label.toLowerCase().includes(term.toLowerCase()))
                .map((p) => (
                  <Command.Item key={p.href} value={p.href} onSelect={() => go(p.href)} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-[13px] text-ink data-[selected=true]:bg-fog">
                    <p.icon size={16} aria-hidden /> {p.label}
                  </Command.Item>
                ))}
            </Command.Group>
          )}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
