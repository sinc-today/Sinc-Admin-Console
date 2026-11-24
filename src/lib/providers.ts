'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface ProviderInfo {
  code: string;
  seen: { country: string; currency: string; payments: number; lastAt: string }[];
  priced: { country: string; currency: string }[];
}
export interface MissingFee {
  provider: string;
  country: string;
  currency: string;
  payments: number;
  lastAt: string;
}

/** Aggregators and SMS gateways the console knows about: known codes, ones with fees set, and ones seen in payments. */
export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: () => api<{ providers: ProviderInfo[]; missing: MissingFee[]; smsGateways: string[] }>('/money/providers'),
    staleTime: 5 * 60_000,
  });
}
