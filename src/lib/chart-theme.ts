/**
 * Chart theme (prompt 8.7). Reads the Ledger tokens as CSS variables so chart
 * code never contains hex values. Series order: ink (current), ember-data
 * (highlighted), brass (secondary), ink-secondary, ink-disabled (compare, dashed).
 */
export const C = {
  ink: 'var(--ink)',
  inkSecondary: 'var(--ink-secondary)',
  inkMuted: 'var(--ink-muted)',
  inkDisabled: 'var(--ink-disabled)',
  line: 'var(--line)',
  lineStrong: 'var(--line-strong)',
  ember: 'var(--ember)',
  emberData: 'var(--ember-data)',
  brass: 'var(--brass)',
  canvas: 'var(--surface-canvas)',
  fog: 'var(--surface-fog)',
};

export const SERIES = [C.ink, C.emberData, C.brass, C.inkSecondary];

export const axisTick = { fill: C.inkSecondary, fontSize: 12, fontFamily: 'var(--font-ui)' };
