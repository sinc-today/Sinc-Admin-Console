import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Rail } from '@/components/shell/Rail';
import { MobileFilters } from '@/components/shell/MobileFilters';
import { FilterMemory } from '@/components/shell/FilterMemory';
import { ResponsiveTables } from '@/components/shell/ResponsiveTables';
import { TopBar } from '@/components/shell/TopBar';
import { ErrorState } from '@/components/ui';
import { serverApi, type StaffMe } from '@/lib/server-api';
import { UserPane } from '@/components/UserPane';
import { EventPane } from '@/components/EventPane';
import { MeProvider } from './me-context';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const me = await serverApi<StaffMe>('/me');

  if (me.status === 401) {
    const reason = me.message && me.message !== 'Sign in required' ? `?reason=${encodeURIComponent(me.message)}` : '';
    redirect(`/login${reason}`);
  }

  if (!me.data) {
    return (
      <main className="mx-auto max-w-xl p-10">
        <ErrorState message={me.message || "Couldn't load your staff profile."} requestId={me.requestId} />
      </main>
    );
  }

  // SINC_ENV must be set explicitly per deploy (production | staging | development); unset shows DEV.
  const environment = process.env.SINC_ENV || 'development';
  const partner = !!me.data.staff.partnerId;

  return (
    <MeProvider value={me.data}>
      <div className="flex min-h-dvh bg-ash">
        <div className="hidden shrink-0 md:block">
          <Suspense fallback={<div className="w-60 shrink-0 bg-ash" />}>
            <Rail permissions={me.data.permissions} partner={partner} />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-16" />}>
            <TopBar staff={me.data.staff} environment={environment} partner={partner} />
          </Suspense>
          <Suspense fallback={null}>
            <MobileFilters />
          </Suspense>
          <main id="main" className="mx-auto w-full min-w-0 max-w-[1680px] flex-1 px-3 pb-10 pt-3 sm:px-4 md:pl-0 md:pr-6 md:pt-4" style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}>
            {children}
          </main>
        </div>
      </div>
      <Suspense fallback={null}>
        <FilterMemory />
        <ResponsiveTables />
        {!partner && <UserPane />}
        <EventPane />
      </Suspense>
    </MeProvider>
  );
}
