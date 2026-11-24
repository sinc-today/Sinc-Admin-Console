'use client';

import { parseAsIsoDate, parseAsStringLiteral, useQueryStates } from 'nuqs';

/**
 * Global scope (prompt section 4.1): lives in the URL so every view is
 * shareable, persists across pages, and is read by every analytics query.
 */
export const COMPARE = ['prev', 'yoy', 'none'] as const;
export const COUNTRIES = ['RWA', 'UGA', 'all'] as const;
export const CURRENCIES = ['RWF', 'UGX'] as const;
export const PRESETS = ['today', 'yesterday', '7d', '30d', 'mtd', 'last_month', 'qtd', 'ytd', 'custom'] as const;

export type Preset = (typeof PRESETS)[number];

export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  mtd: 'This month',
  last_month: 'Last month',
  qtd: 'This quarter',
  ytd: 'This year',
  custom: 'Custom range',
};

export const COMPARE_LABELS: Record<(typeof COMPARE)[number], string> = {
  prev: 'Previous period',
  yoy: 'Same period last year',
  none: 'No comparison',
};

export const COUNTRY_LABELS: Record<(typeof COUNTRIES)[number], string> = {
  RWA: 'Rwanda',
  UGA: 'Uganda',
  all: 'All countries',
};

export const COUNTRY_TZ: Record<(typeof COUNTRIES)[number], string> = {
  RWA: 'Africa/Kigali',
  UGA: 'Africa/Kampala',
  all: 'Africa/Kigali',
};

export const DEFAULT_CURRENCY: Record<(typeof COUNTRIES)[number], (typeof CURRENCIES)[number]> = {
  RWA: 'RWF',
  UGA: 'UGX',
  all: 'RWF',
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Inclusive [from, to] calendar dates for a preset, relative to `now`. */
export const presetRange = (preset: Exclude<Preset, 'custom'>, now = new Date()): { from: Date; to: Date } => {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'mtd':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
    case 'last_month':
      return {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    case 'qtd':
      return { from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), to: today };
    case 'ytd':
      return { from: new Date(today.getFullYear(), 0, 1), to: today };
  }
};

export const scopeParsers = {
  range: parseAsStringLiteral(PRESETS).withDefault('30d'),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
  cmp: parseAsStringLiteral(COMPARE).withDefault('prev'),
  country: parseAsStringLiteral(COUNTRIES).withDefault('RWA'),
  cur: parseAsStringLiteral(CURRENCIES),
};

export const useScope = () => {
  const [scope, setScope] = useQueryStates(scopeParsers, { history: 'replace' });
  const resolved =
    scope.range === 'custom' && scope.from && scope.to ? { from: scope.from, to: scope.to } : presetRange(scope.range === 'custom' ? '30d' : scope.range);
  return {
    scope,
    setScope,
    from: resolved.from,
    to: resolved.to,
    currency: scope.cur ?? DEFAULT_CURRENCY[scope.country],
    timeZone: COUNTRY_TZ[scope.country],
  };
};
