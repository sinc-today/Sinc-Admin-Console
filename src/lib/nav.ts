import type { Icon } from '@phosphor-icons/react';
import {
  ChartLineUp,
  Broadcast,
  Coins,
  Handshake,
  Buildings,
  Storefront,
  TrendUp,
  Heart,
  MapTrifold,
  Tray,
  Pulse,
  Megaphone,
  Users,
  IdentificationBadge,
  CalendarBlank,
  Receipt,
  Percent,
  SquaresFour,
  UserGear,
  ClockCounterClockwise,
  ToggleRight,
  GearSix,
  Flag,
  UsersThree,
  IdentificationCard,
} from '@phosphor-icons/react/dist/ssr';

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Permission needed to see the item; undefined = any staff. */
  permission?: string;
  /** Delivery phase from the implementation prompt; 0 = built, > 0 renders an "arrives in" empty state. */
  phase: number;
  description: string;
  /** Not shown in the rail (reached from another page). */
  hidden?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** Pages whose data the date / compare / country / currency filters change. */
const SCOPED = ['/market', '/money', '/partners', '/portal', '/', '/marketplace', '/growth', '/engagement', '/map', '/transactions', '/organizers'];
export const isScoped = (pathname: string) =>
  SCOPED.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`))) &&
  !/^\/transactions\/./.test(pathname) &&
  !/^\/market\/(team|reports|identity|customers|comms|transactions\/)/.test(pathname);


export const NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { href: '/', label: 'Overview', icon: ChartLineUp, permission: 'analytics.read', phase: 0, description: 'GMV, commission revenue, tickets, payment success, signups and active users.' },
      { href: '/live', label: 'Live', icon: Broadcast, permission: 'analytics.read', phase: 0, description: 'Orders, payments and scans as they happen.' },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/money', label: 'Money', icon: Coins, permission: 'money.read', phase: 0, description: 'Collections, payouts, reversals and revenue.' },
      { href: '/transactions', label: 'Transactions', icon: Receipt, permission: 'money.read', phase: 0, description: 'Every payment, withdrawal and reversal.' },
      { href: '/partners', label: 'Partners', icon: Handshake, permission: 'partners.read', phase: 0, description: 'Licence operators, their terms, shares and statements.' },
      { href: '/portal', label: 'Partner view', icon: Buildings, permission: 'partner.portal', phase: 0, description: 'What a licence partner sees.', hidden: true },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/growth', label: 'Growth', icon: TrendUp, permission: 'analytics.read', phase: 0, description: 'Signups, active users, retention and the purchase funnel.' },
      { href: '/engagement', label: 'Engagement', icon: Heart, permission: 'analytics.read', phase: 0, description: 'Posts, likes, comments, search and push.' },
      { href: '/marketplace', label: 'Marketplace', icon: Storefront, permission: 'analytics.read', phase: 0, description: 'Events on sale, sell-through and affiliates.' },
      { href: '/map', label: 'Map', icon: MapTrifold, permission: 'analytics.read', phase: 0, description: 'Events, sales and audience by area.' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/queues', label: 'Queues', icon: Tray, phase: 0, description: 'Verification, KYC, commission requests, reports and failed payouts.' },
      { href: '/health', label: 'Health', icon: Pulse, permission: 'health.read', phase: 0, description: 'Services, databases, providers and jobs.' },
      { href: '/comms', label: 'Comms', icon: Megaphone, permission: 'comms.send', phase: 0, description: 'Bulk push notifications with approval.' },
    ],
  },
  {
    label: 'Directory',
    items: [
      { href: '/users', label: 'Users', icon: Users, permission: 'users.read', phase: 0, description: 'Find users and their history.' },
      { href: '/organizers', label: 'Organizers', icon: IdentificationBadge, permission: 'organizers.read', phase: 0, description: 'Organizer profiles, verification and money.' },
      { href: '/events', label: 'Events', icon: CalendarBlank, permission: 'analytics.read', phase: 0, description: 'Every event with tickets and sales.' },
    ],
  },
];

/** Settings: one rail item, with its own tabs. */
export const SETTINGS: NavItem[] = [
  { href: '/settings/catalog', label: 'Catalog', icon: SquaresFour, permission: 'catalog.manage', phase: 0, description: 'Categories, tags, plans and permissions.' },
  { href: '/settings/fees', label: 'Fees', icon: Percent, permission: 'money.read', phase: 0, description: 'Aggregator fees and SMS prices by date.' },
  { href: '/settings/flags', label: 'Flags', icon: ToggleRight, permission: 'flags.write', phase: 0, description: 'Roll features out by percentage and country.' },
  { href: '/settings/staff', label: 'Staff', icon: UserGear, permission: 'staff.read', phase: 0, description: 'Who has access and what they can do.' },
  { href: '/settings/audit', label: 'Audit', icon: ClockCounterClockwise, permission: 'audit.read', phase: 0, description: 'Every staff action, newest first.' },
];
export const SETTINGS_ICON = GearSix;

/** What licence-partner users see: their market, limited to their countries (admin /market API). */
export const MARKET_NAV: NavGroup[] = [
  {
    label: 'My market',
    items: [
      { href: '/market', label: 'Market', icon: ChartLineUp, permission: 'market.read', phase: 0, description: 'Sales, organizers and events in your countries.' },
      { href: '/market/organizers', label: 'Organizers', icon: IdentificationBadge, permission: 'market.read', phase: 0, description: 'Organizers in your countries; verify them.' },
      { href: '/market/events', label: 'Events', icon: CalendarBlank, permission: 'market.read', phase: 0, description: 'Events in your countries; resend tickets.' },
      { href: '/market/transactions', label: 'Payments', icon: Receipt, permission: 'market.transactions.read', phase: 0, description: 'Payments in your countries.' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/market/identity', label: 'Identity checks', icon: IdentificationCard, permission: 'market.identity.review', phase: 0, description: "Organizer owners' identity checks." },
      { href: '/market/reports', label: 'Reported posts', icon: Flag, permission: 'market.posts.moderate', phase: 0, description: 'Posts people reported on your events.' },
      { href: '/market/comms', label: 'Push requests', icon: Megaphone, permission: 'market.comms.request', phase: 0, description: 'Ask Sinc to send a push to your country.' },
    ],
  },
  {
    label: 'Partnership',
    items: [
      { href: '/portal', label: 'Earnings', icon: Buildings, permission: 'partner.portal', phase: 0, description: 'Your share, statements and ranking.' },
      { href: '/market/team', label: 'Team', icon: UsersThree, permission: 'market.team.manage', phase: 0, description: 'Who on your team can sign in, and what they can do.' },
    ],
  },
];

export const ALL_NAV_ITEMS = [...NAV.flatMap((g) => g.items), ...SETTINGS];
const MARKET_ITEMS = MARKET_NAV.flatMap((g) => g.items);

export const findNavItem = (pathname: string): NavItem | undefined => {
  const match = (i: NavItem) => (i.href === '/' ? pathname === '/' : pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (pathname === '/market' || pathname.startsWith('/market/')) return [...MARKET_ITEMS].reverse().find(match);
  return ALL_NAV_ITEMS.find(match);
};
