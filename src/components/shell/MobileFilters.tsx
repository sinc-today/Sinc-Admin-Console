'use client';

import * as Popover from '@radix-ui/react-popover';
import { CalendarBlank } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { isScoped } from '@/lib/nav';
import { COUNTRY_LABELS, PRESET_LABELS, useScope } from '@/lib/scope';
import { ScopePill } from './ScopePill';

/** Below 1024px the scope filters sit behind one "Filters" button instead of a row that scrolls sideways. */
export function MobileFilters() {
  const pathname = usePathname() ?? '/';
  const { scope } = useScope();
  if (!isScoped(pathname)) return null;
  const summary = [scope.range === 'custom' ? 'Custom dates' : PRESET_LABELS[scope.range], !(pathname.startsWith('/portal') || pathname === '/market' || pathname.startsWith('/market/')) && COUNTRY_LABELS[scope.country]].filter(Boolean).join(' · ');
  return (
    <div className="px-3 pb-2 sm:px-4 md:pl-0 md:pr-6 lg:hidden">
      <Popover.Root>
        <Popover.Trigger aria-label={`Report dates and country: ${summary}. Change`} className="flex h-10 max-w-full items-center gap-2 rounded-pill bg-canvas px-4 text-[14px] text-ink hover:bg-fog">
          <CalendarBlank size={16} aria-hidden className="shrink-0" /> <span className="truncate">{summary}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={8} collisionPadding={12} className="z-40 border border-line-strong bg-canvas shadow-lg" style={{ borderRadius: 0 }}>
            <ScopePill stacked />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
