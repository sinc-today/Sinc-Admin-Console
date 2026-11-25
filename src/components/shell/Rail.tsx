'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { SincLogo, SincMark } from '../Brand';
import { usePathname, useSearchParams } from 'next/navigation';
import { CaretDown, SidebarSimple } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isScoped, MARKET_NAV, NAV, SETTINGS, SETTINGS_ICON, type NavItem } from '@/lib/nav';
import { api } from '@/lib/api';

const SCOPE_KEYS = ['range', 'from', 'to', 'cmp', 'country', 'cur'];

/**
 * Left rail: 240px, collapsible to a 64px icon rail; remembers the choice per browser. On phones the same
 * navigation opens full-width in a drawer (`drawer`), always expanded and without the collapse button.
 */
export function Rail({ permissions, partner = false, drawer = false }: { permissions: string[]; partner?: boolean; drawer?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [collapsedPref, setCollapsed] = useState(false);
  const collapsed = drawer ? false : collapsedPref;
  // Open items across the queues this person can work; shown on Queues only when non-zero.
  const queues = useQuery({ queryKey: ['queues'], queryFn: () => api<{ total: number }>('/queues'), refetchInterval: 120_000, staleTime: 60_000, enabled: !partner });
  const alerts = useQuery({
    queryKey: ['health', '/health/alerts'],
    queryFn: () => api<{ items: { firing: boolean }[] }>('/health/alerts'),
    refetchInterval: 120_000,
    staleTime: 60_000,
    enabled: !partner && permissions.includes('health.read'),
  });
  const badges: Record<string, number> = { '/queues': queues.data?.total ?? 0, '/health': alerts.data?.items.filter((a) => a.firing).length ?? 0 };
  const badgeLabel: Record<string, string> = { '/queues': 'open', '/health': 'alerts' };
  // Groups the person closed stay closed in this browser.
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setClosed(JSON.parse(localStorage.getItem('sinc-admin-rail-groups') ?? '[]'));
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleGroup = (label: string) =>
    setClosed((c) => {
      const next = c.includes(label) ? c.filter((x) => x !== label) : [...c, label];
      try {
        localStorage.setItem('sinc-admin-rail-groups', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  // Below 1280px the rail starts collapsed (prompt 8.9); an explicit choice is remembered per browser.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem('sinc-admin-rail');
    } catch {
      /* storage unavailable */
    }
    setCollapsed(stored ? stored === 'collapsed' : window.matchMedia('(max-width: 1279px)').matches);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sinc-admin-rail', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  // Carry the global scope across pages.
  const scopeQuery = (() => {
    const q = new URLSearchParams();
    SCOPE_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) q.set(k, v);
    });
    const s = q.toString();
    return s ? `?${s}` : '';
  })();

  // Partner accounts see their market (MARKET_NAV), filtered by their partner role.
  const can = (p?: string) => (!p ? !partner : permissions.includes(p));
  const nav = partner ? MARKET_NAV : NAV;
  // The most specific match wins (Market vs Market › Organizers).
  const activeHref = [...nav.flatMap((g) => g.items)]
    .filter((i) => (i.href === '/' ? pathname === '/' : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (i: NavItem) => i.href === activeHref;
  const settings = SETTINGS.filter((i) => can(i.permission));

  return (
    <nav
      aria-label="Main"
      className={clsx(
        drawer ? 'flex min-h-full w-full flex-col bg-ash px-3 pb-6 pt-4' : 'sticky top-0 flex h-dvh shrink-0 flex-col overflow-y-auto bg-ash py-4 transition-[width] duration-150 ease-ledger',
        !drawer && (collapsed ? 'w-16 px-2' : 'w-60 px-3')
      )}
    >
      <div className={clsx('mb-6 flex items-center', collapsed ? 'flex-col justify-center gap-3' : 'h-10 justify-between px-3')}>
        {collapsed && (
          <Link href={`/${scopeQuery}`} aria-label="Sinc Admin, overview" className="flex h-8 cursor-pointer items-center transition-transform hover:scale-105">
            <SincMark className="h-7" label="" />
          </Link>
        )}
        {!collapsed && (
          <Link href={`/${scopeQuery}`} aria-label="Sinc Admin, overview" className="flex h-7 cursor-pointer items-center rounded-[6px] transition-opacity hover:opacity-80">
            <SincLogo className="h-7" />
          </Link>
        )}
        {!drawer && <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
          className="flex size-10 items-center justify-center text-ink-secondary hover:text-ink"
        >
          <SidebarSimple size={20} aria-hidden />
        </button>}
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {nav.map((group, gi) => {
          const items = group.items.filter((i) => can(i.permission) && (partner || !i.hidden));
          if (items.length === 0) return null;
          const label = group.label ?? String(gi);
          const hasActive = items.some((i) => isActive(i));
          const open = collapsed || partner || !closed.includes(label) || hasActive;
          const listId = `rail-group-${gi}`;
          return (
            <div key={label}>
              {group.label && !collapsed && !partner && (
                <button
                  type="button"
                  onClick={() => toggleGroup(label)}
                  aria-expanded={open}
                  aria-controls={listId}
                  className="mb-1 flex h-7 w-full items-center justify-between px-3 text-[12px] font-medium text-ink-muted hover:text-ink"
                >
                  {group.label}
                  <CaretDown size={12} aria-hidden className={clsx('transition-transform duration-150', !open && '-rotate-90')} />
                </button>
              )}
              {collapsed && gi > 0 && <hr className="mx-3 mb-2 border-line-strong" aria-hidden />}
              {open && (
                <ul id={listId} className="flex flex-col gap-0.5">
                  {items.map((item) => (
                    <RailLink key={item.href} item={item} active={isActive(item)} collapsed={collapsed} large={drawer} href={`${item.href}${isScoped(item.href) ? scopeQuery : ''}`} badge={badges[item.href]} badgeLabel={badgeLabel[item.href]} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {!partner && settings.length > 0 && (
          <ul className="mt-auto flex flex-col gap-0.5 pt-4">
            <RailLink
              item={{ href: settings[0].href, label: 'Settings', icon: SETTINGS_ICON, phase: 0, description: '' }}
              active={pathname.startsWith('/settings')}
              collapsed={collapsed}
              large={drawer}
              href={settings[0].href}
            />
          </ul>
        )}
      </div>
    </nav>
  );
}

function RailLink({ item, active, collapsed, href, badge, badgeLabel, large = false }: { item: NavItem; active: boolean; collapsed: boolean; href: string; badge?: number; badgeLabel?: string; large?: boolean }) {
  const Icon = item.icon;
  // Fixed-position tooltip so the scrolling rail does not clip it.
  const [tip, setTip] = useState<number | null>(null);
  const showTip = (e: React.SyntheticEvent<HTMLElement>) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip(r.top + r.height / 2);
  };
  return (
    <li className="relative" onMouseEnter={showTip} onMouseLeave={() => setTip(null)} onFocus={showTip} onBlur={() => setTip(null)}>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? `${item.label}${badge ? `, ${badge} ${badgeLabel ?? ''}` : ''}` : undefined}
        className={clsx(
          'group display relative flex items-center gap-3 rounded-pill text-[16px] leading-none transition-colors duration-150',
          large ? 'h-12 text-[17px]' : 'h-10',
          collapsed ? 'justify-center px-0' : 'px-3',
          active ? 'bg-canvas text-ink' : 'text-ink-secondary hover:bg-fog hover:text-ink'
        )}
      >
        {active && <span aria-hidden className="absolute left-0 top-2.5 h-5 w-0.5 bg-ember" />}
        <Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden className={clsx('shrink-0 transition-transform duration-150', !active && 'group-hover:scale-110', active && 'text-ember')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!!badge && (
          <span
            className={clsx('num rounded-tag bg-ink px-1.5 text-[11px] leading-[18px] text-canvas', collapsed ? 'absolute right-1 top-0.5' : 'ml-auto')}
            aria-label={collapsed ? undefined : `${badge} ${badgeLabel ?? ''}`}
            aria-hidden={collapsed || undefined}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
      {collapsed && tip !== null && (
        <span role="tooltip" style={{ top: tip, left: 64 }} className="pointer-events-none fixed z-50 ml-1 -translate-y-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[12px] text-canvas">
          {item.label}
        </span>
      )}
    </li>
  );
}
