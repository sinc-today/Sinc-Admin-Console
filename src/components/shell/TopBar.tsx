'use client';

import * as Popover from '@radix-ui/react-popover';
import { SignOut } from '@phosphor-icons/react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '../Avatar';
import { api } from '@/lib/api';
import { findNavItem, isScoped } from '@/lib/nav';
import { CommandPalette } from './CommandPalette';
import { ScopePill } from './ScopePill';
import { ChangePasswordDialog } from './ChangePassword';
import { MobileNav } from './MobileNav';

export function TopBar({ staff, environment, partner = false }: { staff: { displayName: string; email: string; role: { name: string } }; environment: string; partner?: boolean }) {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const title = pathname.startsWith('/settings') ? 'Settings' : (item?.label ?? 'Sinc Admin');
  const scoped = isScoped(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 bg-ash px-3 sm:gap-4 md:h-16 md:pl-0 md:pr-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <MobileNav partner={partner} />
      <h1 className="display min-w-0 shrink truncate text-[22px] leading-none text-ink sm:text-[26px] md:text-[32px]">{title}</h1>
      {scoped && (
        <div className="ml-2 hidden min-w-0 lg:block">
          <ScopePill />
        </div>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
        {!partner && <CommandPalette />}
        <EnvTag environment={environment} />
        <AccountMenu staff={staff} />
      </div>
    </header>
  );
}

function EnvTag({ environment }: { environment: string }) {
  const prod = environment === 'production';
  return (
    <span
      className={`inline-flex h-6 items-center rounded-tag px-2 text-[11px] font-medium sm:px-2.5 sm:text-[12px] ${prod ? 'bg-canvas text-ink' : 'bg-ivory text-brass-ink'}`}
      title={prod ? 'You are working on live data' : 'Not production'}
    >
      {prod ? 'PROD' : environment === 'staging' ? 'QA' : 'DEV'}
    </span>
  );
}

function AccountMenu({ staff }: { staff: { displayName: string; email: string; role: { name: string }; imageUrl?: string | null } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const initials = staff.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const signOut = async () => {
    setBusy(true);
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
    }
  };

  return (
    <>
    <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
    <Popover.Root>
      <Popover.Trigger
        aria-label={`Account: ${staff.displayName}`}
        className="display flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-pill bg-canvas text-[14px] text-ink ring-ember transition-shadow hover:bg-fog hover:ring-2 focus-visible:ring-2"
      >
        {staff.imageUrl ? <Avatar src={staff.imageUrl} name={staff.displayName} size={40} /> : initials}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 w-[min(16rem,calc(100vw-24px))] border border-line-strong bg-canvas p-4" style={{ borderRadius: 0 }}>
          <div className="flex items-center gap-3">
            <Avatar src={staff.imageUrl} name={staff.displayName} size={44} />
            <div className="min-w-0">
              <p className="display truncate text-[16px] text-ink">{staff.displayName}</p>
              <p className="mt-0.5 truncate text-[12px] text-ink-muted">{staff.email}</p>
            </div>
          </div>
          <p className="mt-2 text-[12px] font-medium text-ink-secondary">{staff.role.name}</p>
          <ThemePicker />
          <DensityPicker />
          <Popover.Close asChild>
            <button type="button" onClick={() => setPwOpen(true)} className="mt-4 flex h-10 w-full items-center justify-center border border-line-strong text-[14px] text-ink hover:bg-fog">
              Change password
            </button>
          </Popover.Close>
          <button
            type="button"
            onClick={signOut}
            disabled={busy}
            className="display mt-4 flex h-10 w-full items-center justify-center gap-2 border border-ink text-[15px] text-ink hover:bg-fog disabled:text-ink-disabled"
          >
            <SignOut size={16} aria-hidden /> Sign out
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
    </>
  );
}

const THEMES = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const;

/** Light, dark or follow the system; remembered in this browser. */
function ThemePicker() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document === 'undefined') return 'system';
    return document.documentElement.dataset.theme ?? 'system';
  });
  const pick = (t: string) => {
    setTheme(t);
    if (t === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    try {
      if (t === 'system') localStorage.removeItem('sinc-admin-theme');
      else localStorage.setItem('sinc-admin-theme', t);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-3 border border-line-strong">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={theme === t.key}
          onClick={() => pick(t.key)}
          className={`h-8 text-[13px] ${theme === t.key ? 'bg-ink text-canvas' : 'text-ink hover:bg-fog'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const DENSITIES = [
  { key: 'comfortable', label: 'Comfortable' },
  { key: 'compact', label: 'Compact' },
] as const;

/** Row height and card padding; remembered in this browser. */
function DensityPicker() {
  const [density, setDensity] = useState<string>(() => (typeof document === 'undefined' ? 'comfortable' : (document.documentElement.dataset.density ?? 'comfortable')));
  const pick = (d: string) => {
    setDensity(d);
    if (d === 'comfortable') delete document.documentElement.dataset.density;
    else document.documentElement.dataset.density = d;
    try {
      if (d === 'comfortable') localStorage.removeItem('sinc-admin-density');
      else localStorage.setItem('sinc-admin-density', d);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div role="radiogroup" aria-label="Density" className="mt-2 grid grid-cols-2 border border-line-strong">
      {DENSITIES.map((d) => (
        <button
          key={d.key}
          type="button"
          role="radio"
          aria-checked={density === d.key}
          onClick={() => pick(d.key)}
          className={`h-8 text-[13px] ${density === d.key ? 'bg-ink text-canvas' : 'text-ink hover:bg-fog'}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
