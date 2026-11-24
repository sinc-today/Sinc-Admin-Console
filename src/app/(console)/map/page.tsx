'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { useMemo, useRef, useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { ErrorState, Panel, Skeleton } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../me-context';

interface Outline {
  a2: string;
  rings: [number, number][][];
}
interface EventPt {
  id: number;
  lng: number;
  lat: number;
  name: string;
  startDate: string;
  currency: string | null;
  venue: string | null;
  sold: number;
  processed: number;
}
interface Cell {
  id: string;
  res: string;
  polygon: [number, number][];
  value: number | null;
  people: number | null;
  suppressed: boolean;
}
interface HexData {
  layer: string;
  metric: string;
  currency: string | null;
  res: string;
  floor: number;
  cells: Cell[];
  total: number;
}

/* Local equirectangular projection around the equator: fine for Rwanda and Uganda. */
const K = 100;
const project = ([lng, lat]: [number, number]) => [(lng - 28) * K, (5 - lat) * K] as const;
const EXTENTS = {
  kigali: { label: 'Kigali', box: [29.98, -2.02, 30.18, -1.88] },
  rwanda: { label: 'Rwanda', box: [28.8, -2.9, 30.95, -1.0] },
  uganda: { label: 'Uganda', box: [29.5, -1.5, 35.1, 4.3] },
  both: { label: 'Rwanda and Uganda', box: [28.8, -2.9, 35.1, 4.3] },
} as const;
type ExtentKey = keyof typeof EXTENTS;
const boxToView = (b: readonly number[]) => {
  const [x0, y0] = project([b[0], b[3]]);
  const [x1, y1] = project([b[2], b[1]]);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)'];

export default function MapPage() {
  const can = useCan('analytics.read');
  const { params, key } = useScopeParams();
  const [s, setS] = useQueryStates({ layer: parseAsString.withDefault('sales'), metric: parseAsString.withDefault('tickets'), res: parseAsString.withDefault('city'), view: parseAsString.withDefault('kigali') });
  const [showEvents, setShowEvents] = useState(true);
  const [view, setView] = useState(() => boxToView(EXTENTS[(s.view as ExtentKey) in EXTENTS ? (s.view as ExtentKey) : 'kigali'].box));
  const [selected, setSelected] = useState<{ kind: 'cell'; cell: Cell } | { kind: 'event'; ev: EventPt } | null>(null);

  const outlines = useQuery({ queryKey: ['map-outlines'], queryFn: () => api<{ countries: Outline[]; focus: string[] }>('/map/outlines'), staleTime: Infinity, enabled: can });
  const events = useQuery({ queryKey: ['map-events', key], queryFn: () => api<{ items: EventPt[]; unplaced: number }>(`/map/events?${params}`), enabled: can });
  const hexParams = new URLSearchParams(params);
  hexParams.set('layer', s.layer === 'audience' ? 'audience' : 'sales');
  hexParams.set('metric', s.metric);
  hexParams.set('res', s.res);
  const hex = useQuery({ queryKey: ['map-hex', hexParams.toString()], queryFn: () => api<HexData>(`/map/hex?${hexParams}`), enabled: can && s.layer !== 'none', placeholderData: (p) => p });

  // Quantile breaks over visible values (6 steps).
  const breaks = useMemo(() => {
    const vals = (hex.data?.cells ?? []).filter((c) => !c.suppressed && c.value !== null).map((c) => c.value as number).sort((a, b) => a - b);
    if (!vals.length) return [];
    return [1, 2, 3, 4, 5].map((i) => vals[Math.min(vals.length - 1, Math.floor((vals.length * i) / 6))]);
  }, [hex.data]);
  const colorOf = (v: number) => SEQ[breaks.filter((b) => v > b).length];

  const unit = hex.data?.metric === 'gmv' ? 'money' : 'count';
  const valueLabel = (v: number | null) => (v === null ? 'Fewer than 5 people' : unit === 'money' ? fmt('money', v, hex.data?.currency ?? 'RWF', true) : fmt('count', v));
  const maxSold = Math.max(1, ...(events.data?.items ?? []).map((e) => e.sold));

  /* Pan and zoom */
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const zoom = (factor: number, cx = 0.5, cy = 0.5) =>
    setView((v) => {
      const w = Math.min(900, Math.max(5, v.w * factor));
      const h = (v.h / v.w) * w;
      return { x: v.x + (v.w - w) * cx, y: v.y + (v.h - h) * cy, w, h };
    });
  const goTo = (k: ExtentKey) => {
    setView(boxToView(EXTENTS[k].box));
    setS({ view: k === 'kigali' ? null : k });
  };
  const stroke = view.w / 600;

  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr_320px]">
        <Panel title="Layers" freshness="Venues, sales and audience for the period at the top. Areas with fewer than 5 people are merged or hidden.">
          <fieldset className="flex flex-col gap-2 text-[14px]">
            <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Density</legend>
            {[
              ['sales', 'Sales at the venue'],
              ['audience', 'Audience (shared location)'],
              ['none', 'None'],
            ].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="radio" name="layer" checked={s.layer === k} onChange={() => setS({ layer: k === 'sales' ? null : k })} /> {l}
              </label>
            ))}
          </fieldset>
          {s.layer === 'sales' && (
            <fieldset className="mt-4 flex flex-col gap-2 text-[14px]">
              <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Measure</legend>
              {[
                ['tickets', 'Tickets'],
                ['gmv', 'Money paid'],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="metric" checked={s.metric === k} onChange={() => setS({ metric: k === 'tickets' ? null : k })} /> {l}
                </label>
              ))}
            </fieldset>
          )}
          {s.layer !== 'none' && (
            <fieldset className="mt-4 flex flex-col gap-2 text-[14px]">
              <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Cell size</legend>
              {[
                ['neighbourhood', 'Neighbourhood (about 0.8 km)'],
                ['city', 'City (about 2 km)'],
                ['region', 'Region (about 10 km)'],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input type="radio" name="res" checked={s.res === k} onChange={() => setS({ res: k === 'city' ? null : k })} /> {l}
                </label>
              ))}
            </fieldset>
          )}
          <label className="mt-4 flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} /> Event venues
          </label>
          <div className="mt-4 flex flex-wrap gap-1" role="group" aria-label="Go to">
            {(Object.keys(EXTENTS) as ExtentKey[]).map((k) => (
              <button key={k} type="button" onClick={() => goTo(k)} className="h-8 rounded-tag bg-fog px-3 text-[13px] hover:bg-line">
                {EXTENTS[k].label}
              </button>
            ))}
          </div>
          {!!breaks.length && (
            <div className="mt-5">
              <p className="text-[12px] font-medium text-ink-secondary">{hex.data?.metric === 'users' ? 'Users' : hex.data?.metric === 'gmv' ? `Money paid (${hex.data.currency})` : 'Tickets'} per cell</p>
              <ul className="mt-2 flex flex-col gap-1 text-[12px]">
                {SEQ.map((c, i) => (
                  <li key={c} className="flex items-center gap-2">
                    <span aria-hidden className="inline-block h-3 w-5" style={{ background: c }} />
                    <span className="num">
                      {i === 0 ? `up to ${valueLabel(breaks[0])}` : i === SEQ.length - 1 ? `over ${valueLabel(breaks[i - 1])}` : `${valueLabel(breaks[i - 1])} to ${valueLabel(breaks[i])}`}
                    </span>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <svg aria-hidden width="20" height="12">
                    <rect width="20" height="12" fill="url(#hatch)" stroke="var(--line-strong)" />
                  </svg>
                  Fewer than 5 people
                </li>
              </ul>
            </div>
          )}
        </Panel>

        <section aria-label="Map" className="relative min-h-[420px] overflow-hidden rounded-panel bg-canvas">
          {outlines.isLoading ? (
            <Skeleton className="h-full min-h-[420px] w-full" />
          ) : (
            <svg
              ref={svgRef}
              role="img"
              aria-label={`Map of ${hex.data?.cells.filter((c) => !c.suppressed).length ?? 0} areas and ${events.data?.items.length ?? 0} event venues. The same data is in the tables below.`}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-[min(70vh,640px)] w-full cursor-grab touch-none select-none active:cursor-grabbing"
              onWheel={(e) => {
                const r = svgRef.current!.getBoundingClientRect();
                zoom(e.deltaY > 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
              }}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const r = svgRef.current!.getBoundingClientRect();
                const scale = Math.max(view.w / r.width, view.h / r.height);
                setView((v) => ({ ...v, x: drag.current!.vx - (e.clientX - drag.current!.x) * scale, y: drag.current!.vy - (e.clientY - drag.current!.y) * scale }));
              }}
              onPointerUp={() => (drag.current = null)}
            >
              <defs>
                <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="6" height="6" fill="var(--surface-canvas)" />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-strong)" strokeWidth="2" />
                </pattern>
              </defs>
              <rect x={-1000} y={-1000} width={4000} height={4000} fill="var(--line)" />
              {outlines.data?.countries.map((c) =>
                c.rings.map((ring, i) => (
                  <polygon
                    key={`${c.a2}${i}`}
                    points={ring.map((p) => project(p).join(',')).join(' ')}
                    fill={outlines.data!.focus.includes(c.a2) ? 'var(--surface-canvas)' : 'var(--surface-fog)'}
                    stroke="var(--line-strong)"
                    strokeWidth={stroke}
                  />
                ))
              )}
              {s.layer !== 'none' &&
                hex.data?.cells.map((c) => (
                  <polygon
                    key={c.id}
                    points={c.polygon.map((p) => project(p).join(',')).join(' ')}
                    fill={c.suppressed ? 'url(#hatch)' : colorOf(c.value ?? 0)}
                    fillOpacity={0.85}
                    stroke={selected?.kind === 'cell' && selected.cell.id === c.id ? 'var(--ink)' : 'var(--surface-canvas)'}
                    strokeWidth={stroke * (selected?.kind === 'cell' && selected.cell.id === c.id ? 3 : 0.6)}
                    onClick={() => setSelected({ kind: 'cell', cell: c })}
                  >
                    <title>{c.suppressed ? 'Fewer than 5 people' : `${valueLabel(c.value)} · ${c.people} people`}</title>
                  </polygon>
                ))}
              {showEvents &&
                events.data?.items.map((e) => {
                  const [x, y] = project([e.lng, e.lat]);
                  const sel = selected?.kind === 'event' && selected.ev.id === e.id;
                  return (
                    <circle
                      key={e.id}
                      cx={x}
                      cy={y}
                      r={stroke * (3 + 9 * Math.sqrt(e.sold / maxSold))}
                      fill={sel ? 'var(--ember)' : 'var(--surface-canvas)'}
                      stroke="var(--ink)"
                      strokeWidth={stroke}
                      onClick={() => setSelected({ kind: 'event', ev: e })}
                    >
                      <title>
                        {e.name}: {fmt('count', e.sold)} tickets
                      </title>
                    </circle>
                  );
                })}
            </svg>
          )}
          <div className="absolute right-3 top-3 flex flex-col gap-1">
            <button type="button" aria-label="Zoom in" onClick={() => zoom(0.7)} className="size-9 bg-canvas text-[18px] outline outline-1 outline-line-strong hover:bg-fog">
              +
            </button>
            <button type="button" aria-label="Zoom out" onClick={() => zoom(1.4)} className="size-9 bg-canvas text-[18px] outline outline-1 outline-line-strong hover:bg-fog">
              −
            </button>
          </div>
          {(hex.isFetching || events.isFetching) && <p className="absolute bottom-3 left-3 bg-canvas px-2 py-1 text-[12px] text-ink-secondary">Loading…</p>}
          {hex.error && (
            <div className="absolute inset-x-3 bottom-3">
              <ErrorState message={(hex.error as Error).message} requestId={(hex.error as ApiError).requestId} onRetry={() => hex.refetch()} />
            </div>
          )}
        </section>

        <Panel title="Selection">
          {!selected ? (
            <p className="text-[13px] text-ink-muted">Select a cell or a venue on the map.</p>
          ) : selected.kind === 'event' ? (
            <div className="flex flex-col gap-2 text-[13px]">
              <p className="display text-[20px] text-ink">{selected.ev.name}</p>
              <p className="text-ink-secondary">{selected.ev.venue ?? 'Venue not named'}</p>
              <p className="num">
                {fmt('count', selected.ev.sold)} tickets · {fmt('money', selected.ev.processed, selected.ev.currency ?? 'RWF')}
              </p>
              <a href={`?event=${selected.ev.id}`} className="underline decoration-ember underline-offset-4">
                Open event
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-[13px]">
              <p className="display text-[20px] text-ink">{valueLabel(selected.cell.value)}</p>
              <p className="text-ink-secondary">
                {selected.cell.suppressed ? 'Hidden to protect privacy' : `${fmt('count', selected.cell.people)} ${s.layer === 'audience' ? 'users' : 'buyers'}`} · {selected.cell.res} cell
              </p>
            </div>
          )}
          {events.data?.unplaced ? <p className="mt-4 text-[12px] text-ink-muted">{fmt('count', events.data.unplaced)} events in this period have no usable location.</p> : null}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Areas" freshness="Same cells as the map, largest first.">
          {hex.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !hex.data?.cells.length ? (
            <p className="py-2 text-[13px] text-ink-muted">No data for this layer and period.</p>
          ) : (
            <Table minWidth={420} head={['Cell', { label: hex.data.metric === 'users' ? 'Users' : hex.data.metric === 'gmv' ? 'Money paid' : 'Tickets', align: 'right' }, { label: 'People', align: 'right' }]}>
              {hex.data.cells.slice(0, 30).map((c) => {
                const [lng, lat] = c.polygon.reduce(([a, b], [x, y]) => [a + x / 6, b + y / 6], [0, 0]);
                return (
                  <tr key={c.id} className="h-10 border-b border-line">
                    <td className={`num ${tdFirst} text-ink-secondary`}>
                      <button type="button" className="underline-offset-4 hover:underline" onClick={() => setSelected({ kind: 'cell', cell: c })}>
                        {lat.toFixed(3)}, {lng.toFixed(3)} ({c.res})
                      </button>
                    </td>
                    <td className={`num ${td} text-right`}>{valueLabel(c.value)}</td>
                    <td className={`num ${tdLast} text-right`}>{c.suppressed ? '< 5' : fmt('count', c.people)}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>
        <Panel title="Event venues" freshness="Public events happening in the period, most tickets first.">
          {events.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !events.data?.items.length ? (
            <p className="py-2 text-[13px] text-ink-muted">No placed events in this period.</p>
          ) : (
            <Table minWidth={420} head={['Event', 'Venue', { label: 'Tickets', align: 'right' }]}>
              {[...events.data.items]
                .sort((a, b) => b.sold - a.sold)
                .slice(0, 30)
                .map((e) => (
                  <tr key={e.id} className="h-10 border-b border-line">
                    <td className={`${tdFirst} max-w-[220px] truncate`}>
                      <a href={`?event=${e.id}`} className="underline decoration-line-strong underline-offset-4">
                        {e.name}
                      </a>
                    </td>
                    <td className={`${td} max-w-[180px] truncate text-ink-secondary`}>{e.venue ?? '–'}</td>
                    <td className={`num ${tdLast} text-right`}>{fmt('count', e.sold)}</td>
                  </tr>
                ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
