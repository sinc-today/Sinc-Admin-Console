'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMe } from '@/app/(console)/me-context';
import { isScoped } from '@/lib/nav';

/** The global filters at the top of the page (dates, compare, country, currency), shared by every scoped page. */
const SCOPE_KEYS = ['range', 'from', 'to', 'cmp', 'country', 'cur'];
/** URL params that open a side pane, pick a tab or point at one row: never remembered. */
const TRANSIENT = new Set(['user', 'event', 'interest', 'item', 'tab', 'cursor', 'after', 'before', 'page', 'reason', 'next']);
const MAX_PAGES = 60;

type Saved = { scope: Record<string, string>; pages: Record<string, { q: Record<string, string>; at: number }> };

const read = (key: string): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    if (v && typeof v === 'object' && v.scope && v.pages) return v;
  } catch {
    /* storage blocked or corrupt */
  }
  return { scope: {}, pages: {} };
};
const write = (key: string, v: Saved) => {
  try {
    const pages = Object.entries(v.pages).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_PAGES);
    localStorage.setItem(key, JSON.stringify({ scope: v.scope, pages: Object.fromEntries(pages) }));
  } catch {
    /* storage full or blocked: filters just aren't remembered */
  }
};

/**
 * Remembers the filters you set, in this browser, per staff member:
 * - the date / compare / country / currency scope, carried to every page that uses it;
 * - each page's own filters (search, status, category, sort, page size…), per page.
 * Opening a page with no filters in its link brings them back. A link that has filters (a shared link, a
 * drill-down) always wins, and clearing filters on a page is remembered too.
 */
export function FilterMemory() {
  const me = useMe();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const key = `sinc-admin:filters:${me.staff.id}`;
  const arrived = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search.toString());
    const scoped = isScoped(pathname);
    const saved = read(key);

    // Just arrived on this page: put back what was remembered for anything the link doesn't set.
    if (arrived.current !== pathname) {
      arrived.current = pathname;
      // The side menu carries the scope in its links, so scope and page filters are checked separately.
      const keys = [...params.keys()].filter((k) => !TRANSIENT.has(k));
      const hasScope = scoped && keys.some((k) => SCOPE_KEYS.includes(k));
      const hasPage = keys.some((k) => !scoped || !SCOPE_KEYS.includes(k));
      const restore = new URLSearchParams(params);
      if (scoped && !hasScope) Object.entries(saved.scope).forEach(([k, v]) => restore.set(k, v));
      if (!hasPage)
        Object.entries(saved.pages[pathname]?.q ?? {}).forEach(([k, v]) => {
          if (!scoped || !SCOPE_KEYS.includes(k)) restore.set(k, v);
        });
      if (restore.toString() !== params.toString()) {
        router.replace(`${pathname}?${restore.toString()}`, { scroll: false });
        return; // the URL change re-runs this effect, which then saves
      }
    }

    // Save the current filters.
    const scope: Record<string, string> = {};
    const page: Record<string, string> = {};
    params.forEach((v, k) => {
      if (TRANSIENT.has(k)) return;
      if (scoped && SCOPE_KEYS.includes(k)) scope[k] = v;
      else page[k] = v;
    });
    if (scoped) saved.scope = scope;
    if (Object.keys(page).length) saved.pages[pathname] = { q: page, at: Date.now() };
    else delete saved.pages[pathname];
    write(key, saved);
  }, [pathname, search, key, router]);

  return null;
}
