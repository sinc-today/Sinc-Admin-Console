'use client';

import { NoAccess } from '@/components/PhasePlaceholder';
import { BarList, MiniLine, QueryPanel, fmt, humanize } from '@/components/analytics-ui';
import { BigNumber, RowLink, Table, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { Delta, InfoTip, InlineEmpty } from '@/components/ui';
import { useAnalytics, useScopeParams } from '@/lib/analytics';
import { PagerBar, useOffsetPager } from '@/components/pager';

interface TopPost {
  id: number;
  eventId: number | null;
  eventName: string | null;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  engagementRate: number | null;
}
import { EventInterest } from './event-interest';
import { useCan } from '../me-context';

interface Summary {
  kinds: { key: string; label: string; total: number | null; previous: number | null; points: { t: string; v: number }[]; unavailable?: boolean }[];
  engagedUsers: number;
  activeUsers: number;
  engagedShare: number | null;
}

export default function EngagementPage() {
  const can = useCan('analytics.read');
  const s = useAnalytics<Summary>('/engagement/summary');
  const { params: scopeParams } = useScopeParams();
  const posts = useOffsetPager<TopPost, { posts: TopPost[]; hasMore: boolean }>('/engagement/top-posts', scopeParams, (r) => ({ items: r.posts, hasMore: r.hasMore }), { initialSize: 10 });
  const search = useAnalytics<{ selections: { type: string; title: string; n: number }[]; tracked: { searches: number; zero: number }; zeroQueries: { q: string; n: number }[]; push: { devices: number; enabled: number } }>('/engagement/search');
  if (!can) return <NoAccess />;
  const d = s.data;
  const get = (k: string) => d?.kinds.find((x) => x.key === k)?.total;
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <BigNumber label="People who engaged" tip="Active users who posted, liked, commented, replied or saved." value={d ? fmt('count', d.engagedUsers) : '…'} sub={d ? `${fmt('ratio', d.engagedShare)} of active users` : undefined} />
        <BigNumber label="Posts and stories" value={d ? fmt('count', (get('posts') ?? 0) + (get('stories') ?? 0)) : '…'} sub={d ? `${fmt('count', get('posts'))} posts · ${fmt('count', get('stories'))} stories` : undefined} />
        <BigNumber label="Interactions" tip="Likes, comments and replies created in this period." value={d ? fmt('count', (get('likes') ?? 0) + (get('comments') ?? 0) + (get('replies') ?? 0)) : '…'} sub={d ? `${fmt('count', (get('postViews') ?? 0) + (get('storyViews') ?? 0), undefined, true)} views` : undefined} />
        <BigNumber
          label="Push allowed"
          tip="Share of all registered devices that allow push. Not limited to the dates at the top."
          value={search.data ? fmt('ratio', search.data.push.devices ? search.data.push.enabled / search.data.push.devices : null) : '…'}
          sub={search.data ? `of ${fmt('count', search.data.push.devices)} devices` : undefined}
        />
      </section>

      <QueryPanel title="Activity by type" query={s} freshness="Created per day in this period, with the change against the comparison period.">
        {(x) => (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
            {x.kinds.map((k) => (
              <div key={k.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] text-ink">{k.label}</p>
                  <p className="num text-[13px] font-medium text-ink">{k.unavailable ? 'Not available' : fmt('count', k.total)}</p>
                </div>
                <div className="min-h-[18px] text-[12px]">{k.previous && k.total !== null ? <Delta value={(k.total - k.previous) / k.previous} polarity="up_is_good" /> : <span className="text-ink-muted">{k.unavailable ? 'Not tracked' : 'No comparison'}</span>}</div>
                <MiniLine points={k.points} unit="count" label={`${k.label} per day`} />
              </div>
            ))}
          </div>
        )}
      </QueryPanel>

      <EventInterest />

      <QueryPanel title="Top posts" query={posts} skeleton="table" freshness="Ranked by likes, plus comments and saves counted double.">
        {(x) =>
          x.posts.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No post activity in this period.</p>
          ) : (
            <>
            <Table minWidth={720} head={['Post', 'Event', { label: 'Views', align: 'right' }, { label: 'Likes', align: 'right' }, { label: 'Comments', align: 'right' }, { label: 'Saves', align: 'right' }, { label: 'Engagement', align: 'right' }, '']}>
              {x.posts.map((p) => (
                <tr key={p.id} className="h-11 border-b border-line">
                  <td className={`num ${tdFirst}`}>#{p.id}</td>
                  <td className={`${td} max-w-[280px] truncate`}>{p.eventId ? <RowLink href={`/events/${p.eventId}`}>{p.eventName ?? `Event #${p.eventId}`}</RowLink> : <span className="text-ink-muted">No event</span>}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', p.views)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', p.likes)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', p.comments)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', p.saves)}</td>
                  <td className={`num ${td} text-right`}>{fmt('ratio', p.engagementRate)}</td>
                  {p.eventId ? <OpenCell href={`/events/${p.eventId}`} name={p.eventName ?? `event ${p.eventId}`} label="Open event" /> : <td className={tdLast} />}
                </tr>
              ))}
            </Table>
            <PagerBar pager={posts} noun="posts" sizes={[10, 25, 50]} />
            </>
          )
        }
      </QueryPanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <QueryPanel title="Opened from search" query={search} skeleton="list" info="Search results people tapped, from search history. Top 8.">
          {(x) => <BarList rows={x.selections.slice(0, 8).map((r) => ({ label: r.title, sub: humanize(r.type), value: r.n }))} unit="count" empty="No searches in this period." />}
        </QueryPanel>
        <QueryPanel title="Searches with no results" query={search} skeleton="list">
          {(x) =>
            x.tracked.searches === 0 ? (
              <InlineEmpty>
                Not tracked yet. <InfoTip label="Setup">Setup: the apps need to send search_performed with result_count to /track.</InfoTip>
              </InlineEmpty>
            ) : (
              <>
                <p className="mb-3 text-[13px] text-ink-secondary">
                  {fmt('ratio', x.tracked.zero / x.tracked.searches)} of {fmt('count', x.tracked.searches)} found nothing
                </p>
                <BarList rows={x.zeroQueries.map((r) => ({ label: r.q, value: r.n }))} unit="count" empty="No zero-result searches." />
              </>
            )
          }
        </QueryPanel>
      </div>
    </div>
  );
}
