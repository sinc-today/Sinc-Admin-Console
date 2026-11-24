'use client';

import * as Popover from '@radix-ui/react-popover';
import { Funnel } from '@phosphor-icons/react';
import { usePathname } from 'next/navigation';
import { isScoped } from '@/lib/nav';
import { COUNTRY_LABELS, PRESET_LABELS, useScope } from '@/lib/scope';
import { ScopePill } from './ScopePill';

/** Below 1024px the scope filters sit behind one "Filters" button instead of a row that scrolls sideways. */
export function MobileFilters() {
  const pathname = usePathname() ?? '/';
  const { scope } = useScope();
  if (!isScoped(pathname)) return null;
  const summary = [scope.range === 'custom' ? 'Custom dates' : PRESET_LABELS[scope.range], !pathname.startsWith('/portal') && COUNTRY_LABELS[scope.country]].filter(Boolean).join(' · ');
  return (
    <div className="pb-2 pr-6 lg:hidden">
      <Popover.Root>
        <Popover.Trigger className="flex h-10 items-center gap-2 rounded-pill bg-canvas px-4 text-[14px] text-ink hover:bg-fog">
          <Funnel size={16} aria-hidden /> Filters <span className="text-ink-muted">{summary}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={8} className="z-50 max-w-[calc(100vw-24px)] overflow-x-auto border border-line-strong bg-ash p-2" style={{ borderRadius: 0 }}>
            <ScopePill />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
