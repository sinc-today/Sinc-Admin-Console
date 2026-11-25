'use client';

import { usePathname } from 'next/navigation';

import * as Popover from '@radix-ui/react-popover';
import clsx from 'clsx';
import { CaretDown, Check, X } from '@phosphor-icons/react';
import { createContext, useContext, useState } from 'react';
import {
  COMPARE,
  COMPARE_LABELS,
  COUNTRIES,
  COUNTRY_LABELS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  PRESETS,
  PRESET_LABELS,
  useScope,
} from '@/lib/scope';

const shortDate = (d: Date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const Stacked = createContext(false);

/**
 * The signature pill: Date range | Compare | Country | Currency. State lives in the URL.
 * `stacked` lays the same controls out as a full-width list (phones).
 */
export function ScopePill({ stacked = false }: { stacked?: boolean } = {}) {
  // The partner dashboard always covers the partner's own countries; only the dates apply there.
  const path = usePathname() ?? '';
  // Partner pages always cover the partner's own countries; only the dates (and comparison) apply there.
  const datesOnly = path.startsWith('/portal') || path === '/market' || path.startsWith('/market/');
  const { scope, setScope, from, to, currency, timeZone } = useScope();
  const changed = scope.range !== '30d' || scope.cmp !== 'prev' || (!datesOnly && (scope.country !== 'RWA' || !!scope.cur));
  const rangeLabel = scope.range === 'custom' ? `${shortDate(from)} to ${shortDate(to)}` : PRESET_LABELS[scope.range];

  return (
    <Stacked.Provider value={stacked}>
    <div role="group" aria-label="Report scope" className={stacked ? 'flex w-[min(340px,calc(100vw-24px))] flex-col bg-canvas py-1' : 'flex h-10 w-max items-center rounded-pill bg-canvas px-2'}>
      <Segment label="Date range" value={rangeLabel} active={scope.range !== '30d'} hint={timeZone.replace('Africa/', '') + ' time'}>
        {(close) => (
          <div className="w-[min(300px,calc(100vw-48px))]">
            <OptionList
              options={PRESETS.filter((p) => p !== 'custom').map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
              selected={scope.range}
              onSelect={(v) => {
                setScope({ range: v as (typeof PRESETS)[number], from: null, to: null });
                close();
              }}
            />
            <CustomRange
              initialFrom={isoDay(from)}
              initialTo={isoDay(to)}
              onApply={(f, t) => {
                setScope({ range: 'custom', from: new Date(f), to: new Date(t) });
                close();
              }}
            />
          </div>
        )}
      </Segment>
      {!datesOnly && (
        <>
      <Divider />
      <Segment label="Compare" value={COMPARE_LABELS[scope.cmp]} active={scope.cmp !== 'prev'}>
        {(close) => (
          <OptionList
            options={COMPARE.map((c) => ({ value: c, label: COMPARE_LABELS[c] }))}
            selected={scope.cmp}
            onSelect={(v) => {
              setScope({ cmp: v as (typeof COMPARE)[number] });
              close();
            }}
          />
        )}
      </Segment>
      <Divider />
      <Segment label="Country" value={COUNTRY_LABELS[scope.country]} active={scope.country !== 'RWA'}>
        {(close) => (
          <OptionList
            options={COUNTRIES.map((c) => ({ value: c, label: COUNTRY_LABELS[c] }))}
            selected={scope.country}
            onSelect={(v) => {
              const country = v as (typeof COUNTRIES)[number];
              // Reset currency to the country's own; "All countries" keeps the current choice.
              setScope({ country, cur: country === 'all' ? scope.cur : null });
              close();
            }}
          />
        )}
      </Segment>
      <Divider />
      <Segment label="Currency" value={currency} active={currency !== DEFAULT_CURRENCY[scope.country]}>
        {(close) => (
          <div className="w-[260px]">
            <OptionList
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              selected={currency}
              onSelect={(v) => {
                setScope({ cur: v as (typeof CURRENCIES)[number] });
                close();
              }}
            />
            <p className="border-t border-line px-3 pb-1 pt-3 text-[12px] text-ink-muted">
              Amounts are never added across currencies. Each currency is reported on its own.
            </p>
          </div>
        )}
      </Segment>
        </>
      )}
      {changed && (
        <>
          <Divider />
          <button
            type="button"
            onClick={() => setScope({ range: null, from: null, to: null, cmp: null, country: null, cur: null })}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-pill px-2.5 text-[12px] font-medium text-ink-secondary hover:bg-fog hover:text-ink"
            title="Back to the last 30 days, Rwanda, RWF"
          >
            <X size={12} aria-hidden /> Reset
          </button>
        </>
      )}
    </div>
    </Stacked.Provider>
  );
}

function Divider() {
  const stacked = useContext(Stacked);
  return stacked ? <span aria-hidden className="mx-3 h-px bg-line" /> : <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />;
}

function Segment({
  label,
  value,
  active,
  hint,
  children,
}: {
  label: string;
  value: string;
  active?: boolean;
  hint?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const stacked = useContext(Stacked);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${value}${hint ? `, ${hint}` : ''}`}
        className={
          stacked
            ? 'flex h-12 w-full items-center justify-between gap-3 px-3 text-left text-[15px] text-ink hover:bg-fog data-[state=open]:bg-ash'
            : 'display flex h-8 items-center gap-1.5 rounded-pill px-3 text-[16px] leading-none text-ink hover:bg-fog data-[state=open]:bg-ash'
        }
      >
        {stacked && <span className="text-[12px] font-medium text-ink-muted">{label}</span>}
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={clsx('truncate whitespace-nowrap', active && 'underline decoration-ember decoration-2 underline-offset-[6px]')}>{value}</span>
          <CaretDown size={14} aria-hidden className="shrink-0 text-ink-muted" />
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[min(70dvh,520px)] min-w-[220px] max-w-[calc(100vw-24px)] overflow-y-auto border border-line-strong bg-canvas py-2 text-[14px] text-ink"
          style={{ borderRadius: 0 }}
        >
          <p className="px-3 pb-2 text-[12px] font-medium text-ink-muted">{label}</p>
          {children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ul role="listbox" aria-label="Options" className="flex flex-col">
      {options.map((o) => {
        const isSelected = o.value === selected;
        return (
          <li key={o.value}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(o.value)}
              className={clsx('flex h-11 w-full sm:h-9 items-center justify-between px-3 text-left hover:bg-fog', isSelected && 'bg-fog')}
            >
              {o.label}
              {isSelected && <Check size={16} aria-hidden />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CustomRange({ initialFrom, initialTo, onApply }: { initialFrom: string; initialTo: string; onApply: (from: string, to: string) => void }) {
  const [f, setF] = useState(initialFrom);
  const [t, setT] = useState(initialTo);
  const invalid = !f || !t || f > t;
  return (
    <form
      className="mt-2 border-t border-line px-3 pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onApply(f, t);
      }}
    >
      <p className="mb-2 text-[12px] font-medium text-ink">Custom range</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          From
          <input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="h-9 border border-line-strong px-2 text-[13px] text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-muted">
          To
          <input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="h-9 border border-line-strong px-2 text-[13px] text-ink" />
        </label>
      </div>
      <button
        type="submit"
        disabled={invalid}
        className="display mt-3 h-9 w-full bg-ink text-[15px] text-canvas disabled:bg-line-strong disabled:text-ink-muted"
      >
        Apply range
      </button>
    </form>
  );
}
