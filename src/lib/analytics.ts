'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useScope } from './scope';

/** Types mirror the admin service (admin/src/services/metrics.ts). */
export type Unit = 'money' | 'count' | 'ratio';
export type Polarity = 'up_is_good' | 'up_is_bad' | 'neutral';

export interface Kpi {
  key: string;
  label: string;
  unit: Unit;
  currency?: string;
  polarity: Polarity;
  definition: string;
  value: number | null;
  compare: { value: number | null; delta: number | null; deltaPct: number | null } | null;
  sparkline: { t: string; v: number | null }[];
}

export interface Series {
  key: string;
  label: string;
  unit: Unit;
  currency?: string;
  definition: string;
  points: { t: string; v: number | null; cmpT: string | null; cmpV: number | null }[];
}

export interface Freshness {
  asOf: string | null;
  source: string;
  expectedEveryMinutes: number;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The scope as admin-service query params (prompt 6.1). */
export const useScopeParams = () => {
  const { scope, from, to, currency, timeZone } = useScope();
  const params = new URLSearchParams({
    from: ymd(from),
    to: ymd(to),
    tz: timeZone,
    compare: scope.cmp,
    country: scope.country,
    currency,
  });
  return { params, key: params.toString(), currency, compare: scope.cmp, timeZone };
};

/** Fetch an analytics endpoint for the current scope. */
export function useAnalytics<T>(path: string, extra: Record<string, string> = {}, opts: { refetchMs?: number; enabled?: boolean } = {}) {
  const { params, key } = useScopeParams();
  const qs = new URLSearchParams(params);
  Object.entries(extra).forEach(([k, v]) => qs.set(k, v));
  return useQuery({
    queryKey: [path, key, extra],
    queryFn: () => api<T>(`${path}?${qs}`),
    refetchInterval: opts.refetchMs,
    enabled: opts.enabled ?? true,
    placeholderData: (prev) => prev,
  });
}

export const freshnessLabel = (f?: Freshness | null) => {
  if (!f) return undefined;
  if (!f.asOf) return 'Waiting for the first rollup';
  const mins = Math.round((Date.now() - new Date(f.asOf).getTime()) / 60_000);
  const stale = mins > f.expectedEveryMinutes * 2 + 2;
  const when = mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : mins < 120 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `${stale ? 'Delayed. ' : ''}Updated ${when}`;
};
