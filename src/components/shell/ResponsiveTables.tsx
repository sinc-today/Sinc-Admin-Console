'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Columns that name the row: on phones that cell becomes the card's title. */
const TITLE_COLUMNS = ['event', 'user', 'organizer', 'customer', 'partner', 'name', 'post', 'staff', 'member'];

const headerLabel = (th: HTMLTableCellElement) => {
  const clone = th.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.sr-only, [role=tooltip], button').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** Gives every cell of a `table.rt` its column name (data-label) and marks the title cell (data-primary). */
const labelTable = (table: HTMLTableElement) => {
  const ths = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
  if (!ths.length) return;
  const labels = ths.map(headerLabel);
  const lower = labels.map((l) => l.toLowerCase());
  let primary = lower.findIndex((l) => TITLE_COLUMNS.includes(l));
  if (primary < 0) primary = 0;
  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    const cells = [...tr.children] as HTMLTableCellElement[];
    if (cells.length === 1 && cells[0].colSpan > 1) {
      tr.dataset.full = '';
      return;
    }
    let col = 0;
    cells.forEach((td) => {
      const label = labels[col] ?? '';
      if (td.dataset.label !== label) td.dataset.label = label;
      if (col === primary) td.dataset.primary = '';
      else delete td.dataset.primary;
      col += td.colSpan || 1;
    });
  });
};

/**
 * Phones: tables marked `rt` turn into a list of cards (styles in globals.css). This labels their cells from
 * the header row, again whenever rows change (paging, search, live refresh).
 */
export function ResponsiveTables() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.getElementById('main') ?? document.body;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.querySelectorAll<HTMLTableElement>('table.rt').forEach(labelTable));
    };
    run();
    const mo = new MutationObserver(run);
    mo.observe(root, { childList: true, subtree: true });
    // Side panes and dialogs live outside <main>.
    const mo2 = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.querySelectorAll<HTMLTableElement>('table.rt').forEach(labelTable));
    });
    mo2.observe(document.body, { childList: true });
    return () => {
      mo.disconnect();
      mo2.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
  return null;
}
