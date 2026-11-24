import { FeaturePanel } from './ui';
import type { NavItem } from '@/lib/nav';

const PHASE_NOTES: Record<number, string> = {
  2: 'Needs the Phase 1 rollups (payments, orders, tickets, signups) to be live and reconciled with finance.',
  3: 'Needs Phase 1 activity and event tracking, plus the directory endpoints.',
  4: 'Builds on the review queues, health metrics and geo rollups added in Phase 4.',
  5: 'Part of the Phase 5 hardening work.',
};

/** Honest placeholder for sections that land in later phases. No fake numbers. */
export function PhasePlaceholder({ item }: { item: NavItem }) {
  return (
    <FeaturePanel tone="canvas" className="max-w-[720px]">
      <p className="text-[12px] font-medium text-ink-muted">Arrives in Phase {item.phase}</p>
      <h2 className="display mt-2 text-[18px] leading-tight text-ink">{item.label}</h2>
      <p className="mt-3 max-w-[65ch] text-[14px] text-ink-secondary">{item.description}</p>
      {PHASE_NOTES[item.phase] && <p className="mt-3 max-w-[65ch] text-[13px] text-ink-muted">{PHASE_NOTES[item.phase]}</p>}
    </FeaturePanel>
  );
}

export function NoAccess() {
  return (
    <FeaturePanel tone="canvas" className="max-w-[640px]">
      <h2 className="display text-[18px] leading-tight text-ink">You don&apos;t have access to this page</h2>
      <p className="mt-3 text-[14px] text-ink-secondary">Your role doesn&apos;t include this area. Ask an owner if you need it.</p>
    </FeaturePanel>
  );
}
