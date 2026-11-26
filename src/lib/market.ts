'use client';

import { usePathname } from 'next/navigation';

/**
 * Market mode: licence partners (and Sinc staff previewing a partner) use the same organizer and event pages
 * under /market/*. In that mode:
 *  - API calls to /organizers and /events go to /market/organizers and /market/events, which the admin service
 *    limits to the partner's countries (and ?partnerId= is passed on for staff previews);
 *  - permission checks are translated to the partner's market permissions; anything Sinc-only reads as "no";
 *  - links go to the market pages, and links to Sinc-only pages (users, transactions) become plain text.
 */
export const isMarketPath = (pathname: string | null | undefined) => !!pathname && (pathname === '/market' || pathname.startsWith('/market/'));
export const useInMarket = () => isMarketPath(usePathname());

const MARKET_PERMISSION: Record<string, string> = {
  'analytics.read': 'market.read',
  'organizers.read': 'market.read',
  'organizers.verify': 'market.organizers.verify',
  'organizers.commission': 'market.commission',
  'tickets.resend': 'market.tickets.resend',
  'posts.moderate': 'market.posts.moderate',
  'money.read': 'market.transactions.read',
};
/** The permission to check for `permission` in market mode, or null when it is Sinc-only. */
export const marketPermission = (permission: string) => (permission.startsWith('market.') || permission === 'partner.portal' ? permission : (MARKET_PERMISSION[permission] ?? null));

/** API path rewrite, used by lib/api when the page is a market page. */
export const marketApiPath = (path: string, search: string) => {
  if (!/^\/(organizers|events|transactions)(\/|\?|$)/.test(path)) return path;
  const partnerId = new URLSearchParams(search).get('partnerId');
  const next = `/market${path}`;
  if (!partnerId) return next;
  return `${next}${next.includes('?') ? '&' : '?'}partnerId=${encodeURIComponent(partnerId)}`;
};

/** App link rewrite in market mode; null = no market page for it (render as text). */
export const marketHref = (href: string, search = '') => {
  if (/^\/(users|partners|settings|money)(\/|$)/.test(href)) return null;
  if (/^\/(organizers|events|transactions)(\/|\?|$)/.test(href)) {
    const partnerId = new URLSearchParams(search).get('partnerId');
    return `/market${href}${partnerId ? `${href.includes('?') ? '&' : '?'}partnerId=${partnerId}` : ''}`;
  }
  return href;
};
