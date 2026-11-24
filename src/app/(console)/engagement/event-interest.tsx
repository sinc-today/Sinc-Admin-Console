'use client';

import clsx from 'clsx';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { QueryPanel, Sparkline, fmt } from '@/components/analytics-ui';
import { RowLink, Table, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { Delta, StatusBadge, InfoTip } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { PagerBar, useOffsetPager } from '@/components/pager';

const SORTS = ['trending', 'views', 'engaged', 'conversion'] as const;
type Sort = (typeof SORTS)[number];

const LABEL: Record<Sort, string> = { trending: 'Trending', views: 'Most opened', engaged: 'Most engaged', conversion: 'Best conversion' };
const HELP: Record<Sort, string> = {
  trending: 'Rising fastest against the same length of time just before the selected range. Interest = opens + 2× likes + 3× comments and saves + 5× tickets.',
  views: 'App opens of the event post plus website visits to the event page.',
  engaged: 'Likes, comments, saves and tickets, weighted as in Trending, without counting plain opens.',
  conversion: 'Share of people who opened the event in the app and got a ticket in the same period. Events with at least 20 people opening them.',
};
const STATUS = { upcoming: ['info', 'Upcoming'], live: ['ok', 'Live'], ended: ['pending', 'Ended'] } as const;

interface Row {
  id: number;
  name: string;
  organizerProfileId: number | null;
  organizer: string | null;
  category: string | null;
  privacy: string | null;
  status: 'upcoming' | 'live' | 'ended';
  opens: number;
  appViews: number;
  webOpens: number;
  viewers: number;
  likes: number;
  comments: number;
  saves: number;
  sincups: number;
  tickets: number;
  viewerBuyers: number;
  interest: number;
  prevInterest: number;
  change: number | null;
  conversion: number | null;
  points: { t: string; v: number }[];
}
interface Data {
  sort: Sort;
  total: number;
  totals: { eventsWithActivity: number; opens: number; webOpens: number; tickets: number };
  events: Row[];
}

/** Which events people are opening, engaging with and buying, and which are rising. */
export function EventInterest() {
  const [sort, setSort] = useQueryState('interest', parseAsStringLiteral(SORTS).withDefault('trending'));
  const { params: scopeParams } = useScopeParams();
  const params = new URLSearchParams(scopeParams);
  params.set('sort', sort);
  const q = useOffsetPager<Row, Data>('/engagement/events', params, (r) => ({ items: r.events, total: r.total }), { initialSize: 20 });
  const t = q.data?.totals;
  return (
    <QueryPanel
      title="Event interest"
      query={q}
      skeleton="table"
      info={t ? `${fmt('count', t.eventsWithActivity)} events with activity · ${fmt('count', t.opens)} opens (${fmt('count', t.webOpens)} on the website) · ${fmt('count', t.tickets)} tickets.` : undefined}
    >
      {(d) => (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1">
          <div role="tablist" aria-label="Rank events by" className="flex flex-wrap items-center gap-1">
          {SORTS.map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={sort === s}
              onClick={() => setSort(s)}
              className={clsx('h-8 rounded-pill px-3 text-[12px] font-medium transition-colors duration-150', sort === s ? 'bg-ink text-canvas' : 'bg-fog text-ink-secondary hover:text-ink')}
            >
              {LABEL[s]}
            </button>
          ))}
          </div>
          <InfoTip label={`About ${LABEL[sort]}`}>{HELP[sort]}</InfoTip>
        </div>
          {d.events.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">
              {sort === 'trending'
                ? 'Nothing is trending. Try the last 7 days.'
                : sort === 'conversion'
                  ? 'No event had 20+ viewers.'
                  : 'No event activity.'}
            </p>
          ) : (
            <Table
              minWidth={1080}
              head={['#', 'Event', 'Opens per day', { label: 'Opens', align: 'right' }, { label: 'Engagement', align: 'right' }, { label: 'Tickets', align: 'right' }, { label: 'Conversion', align: 'right' }, { label: 'vs before', align: 'right' }, '']}
            >
              {d.events.map((e, i) => (
                <tr key={e.id} className="h-14 border-b border-line hover:bg-fog">
                  <td className={`num ${tdFirst} text-ink-muted`}>{(q.page - 1) * q.size + i + 1}</td>
                  <td className={`${td} max-w-[320px]`}>
                    <div className="truncate">
                      <RowLink href={`/events/${e.id}`}>{e.name}</RowLink>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 truncate text-[12px] text-ink-muted">
                      <StatusBadge status={STATUS[e.status][0]}>{STATUS[e.status][1]}</StatusBadge>
                      <span className="truncate">{[e.organizer, e.category, e.privacy === 'PRIVATE' ? 'private' : null].filter(Boolean).join(' · ')}</span>
                    </div>
                  </td>
                  <td className={`${td} w-[160px]`}>
                    <div className="-mt-3">
                      <Sparkline points={e.points} label={`${e.name} app opens per day`} />
                    </div>
                  </td>
                  <td className={`num ${td} text-right`} title={`${e.appViews} in the app · ${e.webOpens} on the website · ${e.viewers} people in the app`}>
                    {fmt('count', e.opens)}
                    <div className="text-[12px] text-ink-muted">{fmt('count', e.viewers)} people</div>
                  </td>
                  <td className={`num ${td} text-right`} title={`${e.likes} likes · ${e.comments} comments · ${e.saves} saves`}>
                    {fmt('count', e.likes + e.comments + e.saves)}
                    <div className="whitespace-nowrap text-[12px] text-ink-muted">
                      {e.likes} likes · {e.comments} comm. · {e.saves} saves
                    </div>
                  </td>
                  <td className={`num ${td} text-right`}>
                    {fmt('count', e.tickets)}
                    {e.sincups > 0 && <div className="whitespace-nowrap text-[12px] text-ink-muted">{fmt('count', e.sincups)} sign-ups</div>}
                  </td>
                  <td className={`num ${td} text-right`} title={`${e.viewerBuyers} of ${e.viewers} people who opened it got a ticket`}>
                    {fmt('ratio', e.conversion)}
                    <div className="whitespace-nowrap text-[12px] text-ink-muted">{e.viewerBuyers} of {e.viewers}</div>
                  </td>
                  <td className={`num ${td} text-right`}>
                    {e.change === null ? <span className="text-[12px] font-medium text-ember-ink">New</span> : <Delta value={e.change} polarity="up_is_good" />}
                    <div className="whitespace-nowrap text-[12px] text-ink-muted">interest {fmt('count', e.interest)}</div>
                  </td>
                  <OpenCell href={`/events/${e.id}`} name={e.name} />
                </tr>
              ))}
            </Table>
          )}
          <PagerBar pager={q} noun="events" sizes={[10, 20, 50]} />
        </>
      )}
    </QueryPanel>
  );
}
