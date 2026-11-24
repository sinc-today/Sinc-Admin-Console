'use client';

import { notFound } from 'next/navigation';
import { Button, Delta, EmptyState, ErrorState, FeaturePanel, Field, inputClass, KpiTile, Panel, StatusBadge, Tag } from '@/components/ui';
import { formatMoney } from '@/lib/format';

/**
 * Living component gallery for the Ledger system (stands in for Storybook in
 * Phase 0). Hidden in production unless NEXT_PUBLIC_SHOW_DESIGN_SYSTEM=1.
 * Values shown here are labelled samples, never real data.
 */
const TOKENS = [
  ['canvas', 'var(--surface-canvas)'],
  ['ash', 'var(--surface-ash)'],
  ['fog', 'var(--surface-fog)'],
  ['ivory', 'var(--surface-ivory)'],
  ['ink', 'var(--ink)'],
  ['ink-secondary', 'var(--ink-secondary)'],
  ['ink-muted', 'var(--ink-muted)'],
  ['ink-disabled', 'var(--ink-disabled)'],
  ['line', 'var(--line)'],
  ['ember', 'var(--ember)'],
  ['ember-data', 'var(--ember-data)'],
  ['ember-ink', 'var(--ember-ink)'],
  ['brass', 'var(--brass)'],
  ['brass-ink', 'var(--brass-ink)'],
] as const;

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SHOW_DESIGN_SYSTEM !== '1') notFound();

  return (
    <div className="flex flex-col gap-5">
      <FeaturePanel tone="ivory">
        <h2 className="display text-[18px] text-ink">Ledger components</h2>
        <p className="mt-1 max-w-[65ch] text-[14px] text-ink-secondary">
          Every primitive in its states. Numbers on this page are samples for layout only.
        </p>
      </FeaturePanel>

      <Panel title="Colour tokens">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
          {TOKENS.map(([name, v]) => (
            <div key={name}>
              <span className="block h-14 border border-line" style={{ background: v }} />
              <p className="mt-2 text-[12px] font-medium text-ink">{name}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex h-6" role="img" aria-label="Sequential colour ramp, light to dark">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="flex-1" style={{ background: `var(--seq-${i})` }} />
          ))}
        </div>
      </Panel>

      <Panel title="Type scale">
        <div className="flex flex-col gap-4">
          <p className="display num text-[66px] leading-[0.91] tracking-[-1.32px]">1,284</p>
          <p className="display text-[40px] leading-[1.2] tracking-[-0.8px]">360 page title</p>
          <p className="display text-[32px] leading-[1.19] tracking-[-0.64px]">Page title and KPI value</p>
          <p className="display text-[16px]">Panel title, nav item, button label</p>
          <p className="text-[18px] font-medium leading-[1.25]">Subheading</p>
          <p className="text-[14px]">Body text for descriptions, inputs and menus.</p>
          <p className="num text-[13px]">Table cell 1,250,000</p>
          <p className="text-[12px] font-medium text-ink-muted">Label, axis, caption, timestamp</p>
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="destructive">Block user</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </Panel>

      <Panel title="Status, tags and deltas">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status="ok">Operational</StatusBadge>
          <StatusBadge status="warning">Degraded</StatusBadge>
          <StatusBadge status="critical">Down</StatusBadge>
          <StatusBadge status="pending">Pending</StatusBadge>
          <Tag>staff.read</Tag>
          <Tag tone="brass">Concerts</Tag>
          <Delta value={0.124} polarity="up_is_good" />
          <Delta value={-0.031} polarity="up_is_good" />
          <Delta value={0.08} polarity="up_is_bad" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <KpiTile label="GMV (sample)" definition="Sample tile" value={formatMoney(48_215_400, 'RWF', { compact: true })} compare={<Delta value={0.124} polarity="up_is_good" />} />
        <KpiTile label="Loading" definition="Loading state" loading />
        <KpiTile label="Empty" definition="Empty state" empty="Not connected yet" />
      </div>

      <Panel title="Form fields">
        <div className="grid max-w-[880px] grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Default" htmlFor="ds-a" helper="Helper text">
            <input id="ds-a" className={inputClass} />
          </Field>
          <Field label="Error" htmlFor="ds-b" error="Enter a valid email">
            <input id="ds-b" aria-invalid className={inputClass} defaultValue="amani@" />
          </Field>
          <Field label="Disabled" htmlFor="ds-c">
            <input id="ds-c" disabled className={inputClass} defaultValue="Read only" />
          </Field>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <EmptyState title="No payments are stuck" body="Pending payments older than 15 minutes appear here." />
        <ErrorState message="The payments service didn't respond. Retry, or check Health." requestId="b1e2c3d4" onRetry={() => undefined} />
      </div>
    </div>
  );
}
