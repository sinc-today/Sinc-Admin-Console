'use client';

import { keepPreviousData, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider, toast } from '@/components/Toaster';
import { RouteProgress } from '@/components/shell/RouteProgress';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // Keep the last result on screen while a new filter or page loads (dimmed by the panels).
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1, placeholderData: keepPreviousData } },
        // Every successful staff action confirms itself; set meta.success for a specific message or meta.silent to skip.
        mutationCache: new MutationCache({
          onSuccess: (_d, _v, _c, m) => {
            if (m.meta?.silent) return;
            toast(typeof m.meta?.success === 'string' ? m.meta.success : 'Saved');
          },
        }),
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <RouteProgress />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
