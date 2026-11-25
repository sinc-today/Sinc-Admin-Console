'use client';

import { Pause, Play } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseAsInteger, useQueryState } from 'nuqs';
import { MiniLine } from '@/components/analytics-ui';
import { CountryCode, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { PagerBar, useOffsetPager } from '@/components/pager';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt, humanize } from '@/components/analytics-ui';
import { Button, ErrorState, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { C, axisTick } from '@/lib/chart-theme';
import { formatRelative } from '@/lib/format';
import { useCan } from '../me-context';

interface Snapshot {
  asOf: string;
  tiles: {
    paidLast5m: number;
    pendingNow: number;
    successRate15m: number | null;
    attempts15m: number;
    scansPerMinute: number;
    requestsPerMinute: number;
    errorRate5m: number | null;
    activeNow?: number;
    activeLastHour?: number;
  };
  activePerMinute?: { t: string; users: number }[];
  pendingByCorrespondent: { correspondent: string; count: number }[];
  perMinute: { t: string; attempts: number; ok: number }[];
  happeningNow: { id: number; name: string; startDate: string; endDate: string; sold: number; scanned: number; scans10m: number; lastScan: string | null }[];
  feed: { id: number; at: string; amount: number; currency: string; status: string; correspondent: string | null; errorMessage: string | null }[];
}

/** One point per minute for the last 3 hours, zeros where nothing happened, so lines don't interpolate across gaps. */
const fillMinutes = (rows: { t: string; attempts: number; ok: number }[]) => {
  const byMin = new Map(rows.map((r) => [Math.floor(new Date(r.t).getTime() / 60_000), r]));
  const now = Math.floor(Date.now() / 60_000);
  return Array.from({ length: 180 }, (_, i) => {
    const m = now - 179 + i;
    const r = byMin.get(m);
    return { t: new Date(m * 60_000).toISOString(), attempts: r?.attempts ?? 0, ok: r?.ok ?? 0 };
  });
};

const hhmm = (t: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Kigali' }).format(new Date(t));

/**
 * Live view. Uses server-sent events; if the stream can't be opened (some
 * proxies buffer it) it falls back to polling every 10 s. Pause stops both,
 * which also satisfies reduced-motion preferences.
 */
export default function LivePage() {
  const can = useCan('analytics.read');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<'stream' | 'poll'>('stream');
  const esRef = useRef<EventSource | null>(null);

  const poll = useCallback(async () => {
    try {
      setSnap(await api<Snapshot>('/live/snapshot'));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    }
  }, []);

  useEffect(() => {
    if (!can || paused) return;
    if (mode === 'poll') {
      poll();
      const id = setInterval(poll, 10_000);
      return () => clearInterval(id);
    }
    let gotMessage = false;
    const es = new EventSource('/admin-api/v1/live/stream');
    esRef.current = es;
    es.addEventListener('snapshot', (e) => {
      gotMessage = true;
      setSnap(JSON.parse((e as MessageEvent).data));
      setError(null);
    });
    es.addEventListener('error', () => {
      if (!gotMessage) {
        es.close();
        setMode('poll');
      }
    });
    const fallback = setTimeout(() => {
      if (!gotMessage) {
        es.close();
        setMode('poll');
      }
    }, 8000);
    return () => {
      clearTimeout(fallback);
      es.close();
    };
  }, [can, paused, mode, poll]);

  if (!can) return <NoAccess />;

  const t = snap?.tiles;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] text-ink-secondary" aria-live="polite">
          {paused ? (
            <StatusBadge status="pending">Paused</StatusBadge>
          ) : snap ? (
            <>
              <StatusBadge status="ok">Live</StatusBadge> <span className="ml-2">Updated {formatRelative(snap.asOf)}. Refreshes every 10 seconds.</span>
            </>
          ) : (
            'Connecting'
          )}
        </p>
        <Button variant="secondary" onClick={() => setPaused((p) => !p)} icon={paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </div>

      {error && !snap && <ErrorState message={error.message} requestId={error.requestId} onRetry={poll} />}

      <section aria-label="Right now" className="grid grid-cols-2 gap-5 md:grid-cols-4 2xl:grid-cols-7">
        <LiveTile
          label="Signed in now"
          value={t ? (t.activeNow ?? 0).toLocaleString('en') : undefined}
          note={t ? `${(t.activeLastHour ?? 0).toLocaleString('en')} in the last hour` : undefined}
        />
        <LiveTile label="Paid in the last 5 min" value={t ? t.paidLast5m.toLocaleString('en') : undefined} />
        <LiveTile label="Payments pending now" value={t ? t.pendingNow.toLocaleString('en') : undefined} note="Started in the last 30 min" />
        <LiveTile
          label="Success rate, 15 min"
          value={t ? fmt('ratio', t.successRate15m) : undefined}
          note={t ? `${t.attempts15m.toLocaleString('en')} attempts` : undefined}
          bad={t?.successRate15m !== null && t?.successRate15m !== undefined && t.successRate15m < 0.75 && t.attempts15m >= 10}
        />
        <LiveTile label="Ticket scans per minute" value={t ? t.scansPerMinute.toFixed(1) : undefined} note="Average over 10 min" />
        <LiveTile label="API requests per minute" value={t ? Math.round(t.requestsPerMinute).toLocaleString('en') : undefined} note="All services, last 5 min" />
        <LiveTile
          label="Server errors"
          value={t ? (t.errorRate5m === null ? 'No traffic' : fmt('ratio', t.errorRate5m)) : undefined}
          note="5xx share, last 5 min"
          bad={(t?.errorRate5m ?? 0) > 0.02}
        />
      </section>

      <ActiveUsersPanel perMinute={snap?.activePerMinute ?? []} />

      <Panel title="Payments per minute, last 3 hours" freshness="Attempts and successful payments, Kigali time">
        {!snap ? (
          <Skeleton className="h-[260px] w-full" />
        ) : snap.perMinute.length === 0 ? (
          <p className="py-2 text-[13px] text-ink-muted">No payment attempts in the last 3 hours.</p>
        ) : (
          <>
            <div className="mb-3 flex gap-5 text-[12px] text-ink-secondary">
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-0.5 w-5 bg-ink" /> Successful
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="inline-block w-5 border-t border-dashed border-ink-disabled" /> Attempts
              </span>
            </div>
            <div className="h-[260px]" role="img" aria-label={`Payments per minute over the last 3 hours: ${snap.perMinute.reduce((a, m) => a + m.ok, 0)} successful of ${snap.perMinute.reduce((a, m) => a + m.attempts, 0)} attempts.`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fillMinutes(snap.perMinute)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="t" tickFormatter={hhmm} tick={axisTick} axisLine={false} tickLine={false} minTickGap={40} />
                  <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    cursor={{ stroke: C.lineStrong }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="chart-tip px-3 py-2 text-[12px]">
                          <p className="font-medium text-ink">{hhmm((payload[0].payload as { t: string }).t)}</p>
                          <p className="num text-ink">{(payload[0].payload as { ok: number }).ok} successful</p>
                          <p className="num text-ink-muted">{(payload[0].payload as { attempts: number }).attempts} attempts</p>
                        </div>
                      ) : null
                    }
                  />
                  <Line type="linear" dataKey="attempts" stroke={C.inkDisabled} strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="ok" stroke={C.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[3fr_2fr]">
        <Panel title="Happening now" freshness="Events between their start and end time">
          {!snap ? (
            <Skeleton className="h-32 w-full" />
          ) : snap.happeningNow.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No events are on right now.</p>
          ) : (
            <div className="relative -mx-4 sm:-mx-6 overflow-x-auto">
              <table className="rt w-full min-w-[620px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-fog text-left text-[12px] text-ink-secondary">
                    <th scope="col" className="h-10 px-6 font-medium">Event</th>
                    <th scope="col" className="px-4 text-right font-medium">Tickets</th>
                    <th scope="col" className="px-4 text-right font-medium">Checked in</th>
                    <th scope="col" className="px-4 text-right font-medium">Scans, 10 min</th>
                    <th scope="col" className="px-6 font-medium">Last scan</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.happeningNow.map((e) => (
                    <tr key={e.id} className="h-11 border-b border-line">
                      <td className="px-6 text-ink">{e.name}</td>
                      <td className="num px-4 text-right">{e.sold.toLocaleString('en')}</td>
                      <td className="num px-4 text-right">
                        {e.scanned.toLocaleString('en')} <span className="text-ink-muted">({e.sold ? Math.round((e.scanned / e.sold) * 100) : 0}%)</span>
                      </td>
                      <td className="num px-4 text-right">{e.scans10m.toLocaleString('en')}</td>
                      <td className="num px-6 text-ink-secondary">{e.lastScan ? formatRelative(e.lastScan) : 'None yet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Latest payments">
          {!snap ? (
            <Skeleton className="h-32 w-full" />
          ) : snap.feed.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">No completed payments in the last 2 hours.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-[13px]">
              {snap.feed.slice(0, 10).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="num text-ink">{fmt('money', f.amount, f.currency)}</span>
                    <span className="ml-2 text-ink-muted">{humanize(f.correspondent)}</span>
                    {f.status === 'FAILED' && f.errorMessage && <span className="block truncate text-[12px] text-ember-ink">{f.errorMessage}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={f.status === 'SUCCESS' ? 'ok' : 'critical'}>{f.status === 'SUCCESS' ? 'Paid' : 'Failed'}</StatusBadge>
                    <span className="num w-24 whitespace-nowrap text-right text-[12px] text-ink-muted">{formatRelative(f.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {snap && snap.pendingByCorrespondent.length > 0 && (
        <p className="text-[12px] text-ink-muted">
          Pending by network: {snap.pendingByCorrespondent.map((p) => `${humanize(p.correspondent)} ${p.count}`).join(', ')}.
        </p>
      )}
      {mode === 'poll' && !paused && <p className="text-[12px] text-ink-muted">Live stream unavailable here, refreshing every 10 seconds instead.</p>}
    </div>
  );
}

function LiveTile({ label, value, note, bad }: { label: string; value?: string; note?: string; bad?: boolean }) {
  return (
    <div className="flex min-h-[128px] flex-col rounded-panel bg-canvas p-5">
      <p className="text-[12px] font-medium text-ink-secondary">{label}</p>
      {value === undefined ? (
        <span className="skeleton mt-3 block h-8 w-24" role="status" aria-label={`Loading ${label}`} />
      ) : (
        <p className={`display num mt-2 text-[32px] leading-[1.19] ${bad ? 'text-ember-ink' : 'text-ink'}`}>{value}</p>
      )}
      {note && <p className="mt-auto text-[12px] text-ink-muted">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ who is using Sinc right now */
interface ActiveRow {
  id: number;
  name: string | null;
  username: string | null;
  lastSeenAt: string;
  platform: string | null;
  country: string | null;
  service: string | null;
}
const WINDOWS = [
  { w: 5, label: 'Now (5 min)' },
  { w: 60, label: 'Last hour' },
  { w: 1440, label: 'Last 24 hours' },
];
const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web', other: 'Other' };

function ActiveUsersPanel({ perMinute }: { perMinute: { t: string; users: number }[] }) {
  const canUsers = useCan('users.read');
  const [win, setWin] = useState(5);
  const [, openUser] = useQueryState('user', parseAsInteger);
  const params = new URLSearchParams({ window: String(win) });
  const pager = useOffsetPager<ActiveRow, { items: ActiveRow[]; total: number }>('/live/active', params, (r) => ({ items: r.items, total: r.total }), {
    enabled: canUsers,
    refetchMs: 15_000,
    initialSize: 10,
  });
  const byMin = new Map(perMinute.map((p) => [Math.floor(new Date(p.t).getTime() / 60_000), p.users]));
  const now = Math.floor(Date.now() / 60_000);
  const line = Array.from({ length: 60 }, (_, i) => ({ t: new Date((now - 59 + i) * 60_000).toISOString(), v: byMin.get(now - 59 + i) ?? 0 }));
  return (
    <Panel title="Who is using Sinc" freshness="Signed-in users, from the traffic the services report every 10 seconds">
      <div className="mb-4">
        <p className="text-[12px] font-medium text-ink-secondary">Signed-in users per minute, last 60 minutes</p>
        <MiniLine points={line} unit="count" label="Signed-in users per minute over the last hour" highlight />
      </div>
      {!canUsers ? (
        <p className="text-[13px] text-ink-muted">Your role can see the count but not who is active.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Time window" className="mb-3 flex flex-wrap gap-1">
            {WINDOWS.map((o) => (
              <button
                key={o.w}
                role="tab"
                type="button"
                aria-selected={win === o.w}
                onClick={() => setWin(o.w)}
                className={`h-8 rounded-pill px-3 text-[12px] font-medium ${win === o.w ? 'bg-ink text-canvas' : 'bg-fog text-ink-secondary hover:text-ink'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {pager.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : pager.items.length === 0 ? (
            <p className="py-2 text-[13px] text-ink-muted">Nobody signed in during this window.</p>
          ) : (
            <Table minWidth={560} head={['User', 'Platform', 'Country', 'Last seen']}>
              {pager.items.map((u) => (
                <tr key={u.id} className="h-10 border-b border-line hover:bg-fog">
                  <td className={tdFirst}>
                    <button type="button" onClick={() => openUser(u.id)} className="text-left text-ink hover:underline hover:decoration-ember hover:underline-offset-4">
                      {u.name || u.username || `User #${u.id}`}
                    </button>
                  </td>
                  <td className={`${td} text-ink-secondary`}>{PLATFORM_LABEL[u.platform ?? 'other'] ?? 'Other'}</td>
                  <td className={td}>
                    <CountryCode code={u.country} />
                  </td>
                  <td className={`num ${tdLast} text-ink-secondary`}>{formatRelative(u.lastSeenAt)}</td>
                </tr>
              ))}
            </Table>
          )}
          <PagerBar pager={pager} noun="active users" sizes={[10, 25, 50]} />
        </>
      )}
    </Panel>
  );
}
