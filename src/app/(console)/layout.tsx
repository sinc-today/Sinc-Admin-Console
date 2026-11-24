import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Rail } from '@/components/shell/Rail';
import { MobileFilters } from '@/components/shell/MobileFilters';
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
        <Suspense fallback={<div className="w-60 shrink-0 bg-ash" />}>
          <Rail permissions={me.data.permissions} partner={partner} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="h-16" />}>
            <TopBar staff={me.data.staff} environment={environment} partner={partner} />
          </Suspense>
          <Suspense fallback={null}>
            <MobileFilters />
          </Suspense>
          <main id="main" className="mx-auto w-full max-w-[1680px] flex-1 pb-10 pr-6 pt-4">
            {children}
          </main>
        </div>
      </div>
      <Suspense fallback={null}>
        {!partner && <UserPane />}
        <EventPane />
      </Suspense>
    </MeProvider>
  );
}
