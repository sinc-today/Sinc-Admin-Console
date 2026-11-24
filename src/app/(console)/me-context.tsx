'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext } from 'react';
import { isMarketPath, marketPermission } from '@/lib/market';
import type { StaffMe } from '@/lib/server-api';

const MeContext = createContext<StaffMe | null>(null);

export function MeProvider({ value, children }: { value: StaffMe; children: React.ReactNode }) {
  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe must be used inside the console layout');
  return me;
}

export function useCan(permission: string) {
  const perms = useMe().permissions;
  const inMarket = isMarketPath(usePathname());
  if (!inMarket) return perms.includes(permission);
  const p = marketPermission(permission);
  return !!p && perms.includes(p);
}
