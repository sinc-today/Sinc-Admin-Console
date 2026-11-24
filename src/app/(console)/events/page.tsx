'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { Flyer } from '@/components/Flyer';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { chipsFor, ExportButton, FilterBar, ListState, RowLink, SavedViews, SearchForm, SelectField, Table, dayFmt, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { PagerBar, useCursorPager } from '@/components/pager';
import { Button, Panel, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { useCan } from '../me-context';
import { useInMarket } from '@/lib/market';

interface EventRow {
  id: number;
  name: string;
  flyer: string | null;
  organizerProfileId: number | null;
  organizer: string | null;
  category: string | null;
  startDate: string;
  endDate: string;
  country: string | null;
  currency: string | null;
  privacy: string | null;
  sold: number;
  capacity: number;
  sellThrough: number | null;
  scanned: number;
  revenue: number;
  processed: number;
  attendanceRate: number | null;
  rank: number;
  ranked: number;
  status: 'upcoming' | 'live' | 'ended';
}

const SORTS = [
  { value: 'processed', label: 'Amount processed' },
  { value: 'sold', label: 'Tickets sold' },
  { value: 'attendance', label: 'Attendance' },
];

const STATUS = { upcoming: ['info', 'Upcoming'], live: ['ok', 'Live'], ended: ['pending', 'Ended'] } as const;

export default function EventsPage() {
  const can = useCan('analytics.read');
  const inMarket = useInMarket();
  const [f, setF] = useQueryStates({ q: parseAsString, status: parseAsString, category: parseAsString, eventCountry: parseAsString, privacy: parseAsString, sort: parseAsString });
  const [, setEvent] = useQueryState('event', parseAsInteger);
  const cats = useQuery({ queryKey: ['event-categories'], queryFn: () => api<{ items: { id: number; name: string }[] }>('/events/categories'), enabled: can, staleTime: 600_000 });
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
  const q = useCursorPager<EventRow>('/events', params, { enabled: can });
  if (!can) return <NoAccess />;
  const items = q.items;
  const exportParams = new URLSearchParams(params);
  exportParams.delete('limit');
  exportParams.delete('sort');
  const ranked = !!f.sort && f.sort !== 'newest';
  const defs = [
    { key: 'status', label: 'Status', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'live', label: 'Live now' }, { value: 'ended', label: 'Ended' }] },
    { key: 'category', label: 'Category', options: (cats.data?.items ?? []).map((c) => ({ value: String(c.id), label: c.name })) },
    { key: 'eventCountry', label: 'Country', options: [{ value: 'RWA', label: 'Rwanda' }, { value: 'UGA', label: 'Uganda' }] },
    { key: 'privacy', label: 'Privacy', options: [{ value: 'PUBLIC', label: 'Public' }, { value: 'PRIVATE', label: 'Private' }] },
    { key: 'sort', label: 'Rank by', options: SORTS },
  ];
  const fv = f as Record<string, string | null>;
  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        search={<SearchForm id="e-q" label="Search events" placeholder="Event id or name" initial={f.q ?? ''} onSearch={(v) => setF({ q: v })} />}
        filters={defs.map((d) => (
          <SelectField key={d.key} id={`e-${d.key}`} label={d.label} value={fv[d.key]} onChange={(v) => setF({ [d.key]: v })} options={d.options} />
        ))}
        active={chipsFor(defs, fv, (k) => setF({ [k]: null }))}
        onClearAll={() => setF({ status: null, category: null, eventCountry: null, privacy: null, sort: null })}
        actions={
          <>
            {!inMarket && <SavedViews page="events" />}
            {!inMarket && <ExportButton path="/exports/events.csv" params={exportParams} />}
          </>
        }
      />
      <Panel
        title="Events"
        freshness={ranked ? `By ${SORTS.find((x) => x.value === f.sort)?.label.toLowerCase()}` : 'Newest first'}
        info="Rank is by amount processed among the events matching these filters, per currency. Lifetime figures. Select an event for details."
        busy={q.isFetching && !!q.isPlaceholderData}
      >
        <ListState q={q} count={items.length} emptyTitle="No events match" emptyBody="Clear a filter or try another name.">
          <Table
            sticky
            head={[
              { label: 'Rank', align: 'right' },
              'Event',
              'Organizer',
              'Starts',
              'Status',
              { label: 'Amount processed', align: 'right' },
              { label: 'Sold', align: 'right' },
              { label: 'Sell-through', align: 'right' },
              { label: 'Attendance', align: 'right' },
              '',
            ]}
            minWidth={1180}
          >
            {items.map((e) => (
              <tr key={e.id} className="h-16 border-b border-line hover:bg-fog">
                <td className={`num ${tdFirst} text-right`} title={e.processed ? `#${e.rank} of ${e.ranked} ${e.currency ?? ''} events by amount processed` : 'Not ranked: nothing processed yet'}>
                  {e.processed ? `#${e.rank}` : <span className="text-ink-muted">–</span>}
                </td>
                <td className={`${td} max-w-[320px]`}>
                  <button type="button" onClick={() => setEvent(e.id)} className="flex w-full min-w-0 items-center gap-3 text-left" aria-label={`${e.name}, event ${e.id}: open details`}>
                    <Flyer src={e.flyer} name={e.name} className="size-11" />
                    <span className="min-w-0">
                      <span className="block truncate text-ink underline decoration-line-strong underline-offset-4">{e.name}</span>
                      <span className="block truncate text-[12px] text-ink-muted">
                        #{e.id}
                        {e.category && ` · ${e.category}`}
                        {e.privacy === 'PRIVATE' && ' · private'}
                      </span>
                    </span>
                  </button>
                </td>
                <td className={`${td} max-w-[180px] truncate`}>{e.organizerProfileId ? <RowLink href={`/organizers/${e.organizerProfileId}`}>{e.organizer ?? `#${e.organizerProfileId}`}</RowLink> : 'None'}</td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{dayFmt(e.startDate)}</td>
                <td className={td}>
                  <StatusBadge status={STATUS[e.status][0]}>{STATUS[e.status][1]}</StatusBadge>
                </td>
                <td className={`num ${td} text-right`}>{e.processed ? fmt('money', e.processed, e.currency ?? 'RWF') : <span className="text-ink-muted">None</span>}</td>
                <td className={`num ${td} text-right`}>{fmt('count', e.sold)}</td>
                <td className={`num ${td} text-right`}>{fmt('ratio', e.sellThrough)}</td>
                <td className={`num ${td} text-right`}>
                  {e.sold ? (
                    <>
                      {fmt('count', e.scanned)}
                      <span className="ml-1 text-[12px] text-ink-muted">{fmt('ratio', e.attendanceRate)}</span>
                    </>
                  ) : (
                    <span className="text-ink-muted">No data</span>
                  )}
                </td>
                <OpenCell href={`/events/${e.id}`} name={e.name} />
              </tr>
            ))}
          </Table>
        </ListState>
        <PagerBar pager={q} noun="events" />
      </Panel>
    </div>
  );
}
