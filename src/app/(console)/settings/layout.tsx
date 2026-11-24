'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SETTINGS } from '@/lib/nav';
import { useMe } from '../me-context';

/** Settings has its own tabs; the rail shows one "Settings" item. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const me = useMe();
  const tabs = SETTINGS.filter((t) => !t.permission || me.permissions.includes(t.permission));
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Settings" className="flex gap-6 overflow-x-auto whitespace-nowrap border-b border-line">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              title={t.description}
              className={clsx(
                'display -mb-px flex h-11 items-center border-b-2 text-[16px] leading-none transition-colors duration-150',
                active ? 'border-ember text-ink' : 'border-transparent text-ink-secondary hover:text-ink'
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
