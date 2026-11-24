#!/usr/bin/env node
/**
 * Token contrast test (prompt sections 8 and 9). Reads the tokens from
 * src/app/globals.css and checks every foreground/background pair the
 * components use. Fails CI if any pair drops below its WCAG 2.2 AA threshold.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/globals.css'), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const tokens = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT = 4.5; // normal text
const UI = 3; // chart marks, borders that convey state, large text

// [foreground, background, minimum, where it's used]
const PAIRS = [
  ...['surface-canvas', 'surface-ash', 'surface-fog', 'surface-ivory'].flatMap((bg) => [
    ['ink', bg, TEXT, 'primary text'],
    ['ink-secondary', bg, TEXT, 'secondary text'],
    ['ink-muted', bg, TEXT, 'helper text, captions'],
    ['ember-ink', bg, TEXT, 'critical text, bad deltas'],
    ['brass-ink', bg, TEXT, 'brass text on tinted surfaces'],
  ]),
  ['brass', 'surface-canvas', TEXT, 'tags, warning text on white'],
  ['brass', 'surface-fog', TEXT, 'brass tags on fog'],
  ['brass-ink', 'brass-wash', TEXT, 'warning badge'],
  ['ember-ink', 'ember-wash', TEXT, 'critical badge'],
  ['surface-canvas', 'ink', TEXT, 'primary button label'],
  ['surface-canvas', 'ink-secondary', TEXT, 'primary button hover label'],
  ['ink-muted', 'line-strong', UI, 'disabled primary button label (large)'],
  ['ember-data', 'surface-canvas', UI, 'highlighted chart series'],
  ['ember-data', 'surface-ash', UI, 'highlighted chart series on ash'],
  ['brass', 'surface-canvas', UI, 'secondary chart series'],
  ['ink', 'surface-canvas', UI, 'focus ring'],
  ['ink', 'seq-3', TEXT, 'heatmap cell text (light half)'],
  ['surface-canvas', 'seq-4', TEXT, 'heatmap cell text (dark half)'],
  ['surface-canvas', 'seq-5', TEXT, 'heatmap cell text'],
  ['ink', 'seq-2', TEXT, 'heatmap cell text'],
  ['surface-canvas', 'seq-6', TEXT, 'heatmap cell text (darkest)'],
];

let failed = 0;
for (const [fg, bg, min, where] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    console.error(`MISSING token ${fg} or ${bg}`);
    failed++;
    continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${fg} on ${bg}  ${where}`);
}

// Known exceptions, documented: --ember (#ff682c) and --ink-disabled are never used for text.
if (failed) {
  console.error(`\n${failed} contrast pair(s) below threshold`);
  process.exit(1);
}
console.log(`\nAll ${PAIRS.length} pairs pass.`);
