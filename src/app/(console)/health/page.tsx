'use client';

import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt, humanize } from '@/components/analytics-ui';
import { Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { ErrorState, InfoTip, InlineEmpty, Panel, Skeleton, SlowNote, StatusBadge } from '@/components/ui';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useCan } from '../me-context';

type Health = 'operational' | 'degraded' | 'down' | 'idle';
const BADGE: Record<Health, [React.ComponentProps<typeof StatusBadge>['status'], string]> = {
  operational: ['ok', 'Operational'],
  degraded: ['warning', 'Degraded'],
  down: ['critical', 'Down'],
  idle: ['info', 'Idle'],
};
const Status = ({ s }: { s: Health }) => <StatusBadge status={BADGE[s][0]}>{BADGE[s][1]}</StatusBadge>;
const ms = (v: number | null) => (v === null ? '–' : v >= 10000 ? '> 10 s' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
const WINDOWS = [15, 60, 360, 1440];
const windowLabel = (m: number) => (m < 60 ? `${m} min` : m === 60 ? '1 hour' : m === 1440 ? '24 hours' : `${m / 60} hours`);

function useHealth<T>(path: string, key: unknown[], refetchMs = 30_000) {
  return useQuery({ queryKey: ['health', path, ...key], queryFn: () => api<T>(path), refetchInterval: refetchMs });
}

function Section<T>({ title, info, actions, q, children }: { title: string; info?: React.ReactNode; actions?: React.ReactNode; q: { isLoading: boolean; error: unknown; data?: T; refetch: () => unknown; isFetching?: boolean; isPlaceholderData?: boolean }; children: (d: T) => React.ReactNode }) {
  const refetching = !!q.data && !!q.isFetching && !!q.isPlaceholderData;
  return (
    <Panel title={title} info={info} actions={actions} busy={refetching}>
      {q.isLoading ? (
        <div role="status" aria-label={`Loading ${title}`}>
          <Skeleton className="h-24 w-full" />
          <SlowNote active />
        </div>
      ) : q.error && !q.data ? (
        <ErrorState what={title.toLowerCase()} message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : q.data ? (
        <div className={refetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>{children(q.data)}</div>
      ) : null}
    </Panel>
  );
}

interface Svc {
  key: string;
  label: string;
  status: Health;
  reachable: boolean;
  probeError: string | null;
  requests: number;
  perMinute: number;
  errorRate: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  lastRequestAt: string | null;
}

export default function HealthPage() {
  const can = useCan('health.read');
  const [s, setS] = useQueryStates({ minutes: parseAsInteger.withDefault(60), service: parseAsString });
  const [openSvc, setOpenSvc] = useState<string | null>(null);
  const svc = useHealth<{ services: Svc[] }>(`/health/services?minutes=${s.minutes}`, [s.minutes]);
  const routes = useHealth<{ items: { service: string; method: string; route: string; requests: number; errorRate: number | null; clientErrorRate: number | null; p95: number | null; avgMs: number | null }[] }>(
    `/health/routes?minutes=${s.minutes}${s.service ? `&service=${s.service}` : ''}`,
    [s.minutes, s.service]
  );
  const providers = useHealth<{
    payments: { gateway: string; attempts: number; succeeded: number; failed: number; pending: number; successRate: number | null; p95Seconds: number | null; lastSuccessAt: string | null; status: Health }[];
    sms: { gateway: string; sent: number; failed: number; failRate: number | null; lastAt: string | null }[];
  }>('/health/providers', [], 60_000);
  const dbs = useHealth<{ items: { label: string; configured: boolean; ok?: boolean; error?: string; pingMs?: number; size?: string; connections?: number; active?: number; longest?: number | null; max?: number; slow?: { query: string; calls: number; mean_ms: number }[] }[] }>('/health/databases', [], 60_000);
  const jobs = useHealth<{
    items: { job: string; schedule: string; runs24h: number; failed24h: number; lastStartedAt: string; lastStatus: string; lastError: string | null; avgSeconds: number | null; status: Health }[];
    partnerCredits: { waiting: number; failed: number; oldestWaitingAt: string | null; status: Health };
    saleSplits: { checked: boolean; reason?: string; payments?: number; missing?: number; oldestMissingAt?: string | null; sample?: number[] };
  }>('/health/jobs', [], 60_000);
  const rabbit = useHealth<{ configured: boolean; items: { name: string; depth: number; unacked: number; consumers: number; publishRate: number; deliverRate: number; status: Health }[] }>('/health/queues', [], 30_000);
  if (!can) return <NoAccess />;
  // With nothing to list, the three integrations sit side by side as one-liners.
  const quiet = !providers.data?.payments.length && !providers.data?.sms.length && !(rabbit.data?.configured && rabbit.data.items.length);

  return (
    <div className="flex flex-col gap-5">
      <Alerts />
      <div role="group" aria-label="Time window" className="flex flex-wrap items-center gap-1">
        <span className="mr-2 text-[13px] text-ink-secondary">Window</span>
        {WINDOWS.map((m) => (
          <button key={m} type="button" aria-pressed={s.minutes === m} onClick={() => setS({ minutes: m === 60 ? null : m })} className={s.minutes === m ? 'h-8 rounded-tag bg-ink px-3 text-[13px] text-canvas' : 'h-8 rounded-tag bg-canvas px-3 text-[13px] text-ink hover:bg-fog'}>
            {windowLabel(m)}
          </button>
        ))}
      </div>

      <Section title="Services" info={`Requests over the last ${windowLabel(s.minutes)}; reachability checked now. Refreshes every 30 seconds. Select a row for details.`} q={svc}>
        {(d) => (
          <Table minWidth={680} head={['Service', 'Status', { label: 'Requests/min', align: 'right' }, { label: '5xx', align: 'right' }, { label: 'p95', align: 'right' }, 'Last request']}>
            {d.services.map((x) => (
              <ServiceRow key={x.key} x={x} open={openSvc === x.key} onToggle={() => setOpenSvc(openSvc === x.key ? null : x.key)} onRoutes={() => setS({ service: x.key === 'admin' ? null : x.key })} />
            ))}
          </Table>
        )}
      </Section>

      <Section title={`Routes${s.service ? `: ${humanize(s.service)}` : ''}`} info="Worst error rate first. Latency is the upper bound of the histogram bucket." q={routes}>
        {(d) => (
          <>
            {s.service && (
              <button type="button" className="mb-3 text-[13px] underline underline-offset-4" onClick={() => setS({ service: null })}>
                Show all services
              </button>
            )}
            {!d.items.length ? (
              <InlineEmpty>
                No requests in this window. <InfoTip label="Setup">Setup: each service needs ADMIN_INGEST_URL set to report requests.</InfoTip>
              </InlineEmpty>
            ) : (
              <Table minWidth={820} head={['Service', 'Route', { label: 'Requests', align: 'right' }, { label: '5xx', align: 'right' }, { label: '4xx', align: 'right' }, { label: 'Average', align: 'right' }, { label: 'p95', align: 'right' }]}>
                {d.items.slice(0, 50).map((r) => (
                  <tr key={`${r.service}${r.method}${r.route}`} className="h-10 border-b border-line">
                    <td className={`${tdFirst} text-ink-secondary`}>{humanize(r.service)}</td>
                    <td className={`${td} max-w-[420px] truncate font-mono text-[12px]`} title={`${r.method} ${r.route}`}>
                      {r.method} {r.route}
                    </td>
                    <td className={`num ${td} text-right`}>{fmt('count', r.requests)}</td>
                    <td className={`num ${td} text-right ${r.errorRate && r.errorRate > 0.05 ? 'text-ember-ink' : ''}`}>{fmt('ratio', r.errorRate)}</td>
                    <td className={`num ${td} text-right`}>{fmt('ratio', r.clientErrorRate)}</td>
                    <td className={`num ${td} text-right`}>{ms(r.avgMs)}</td>
                    <td className={`num ${tdLast} text-right`}>{ms(r.p95)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Section title="Databases" info="From each database's own statistics. Slow queries need pg_stat_statements." q={dbs}>
          {(d) => (
            <ul className="flex flex-col gap-3">
              {d.items.map((x) => (
                <li key={x.label} className="bg-fog p-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{x.label}</span>
                    {!x.configured ? <span className="text-ink-muted">Not configured</span> : x.ok ? <Status s={(x.connections ?? 0) > (x.max ?? 100) * 0.8 ? 'degraded' : 'operational'} /> : <Status s="down" />}
                  </div>
                  {x.ok && (
                    <p className="num mt-1 text-[12px] text-ink-secondary">
                      {x.size} · {x.connections}/{x.max} connections ({x.active} active) · ping {x.pingMs} ms{x.longest ? ` · longest query ${x.longest} s` : ''}
                    </p>
                  )}
                  {x.error && <p className="mt-1 text-[12px] text-ember-ink">{x.error}</p>}
                  {!!x.slow?.length && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px]">Slowest queries</summary>
                      <ul className="mt-1 flex flex-col gap-1 font-mono text-[11px] text-ink-secondary">
                        {x.slow.map((q, i) => (
                          <li key={i} className="truncate" title={q.query}>
                            {q.mean_ms} ms × {q.calls}: {q.query}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Scheduled jobs" info="The console's own jobs over the last 24 hours. Hover a row to see its last error." q={jobs}>
          {(d) => (
            <>
              <Table minWidth={520} head={['Job', 'Status', { label: 'Runs', align: 'right' }, { label: 'Failed', align: 'right' }, 'Last run']}>
                {d.items.map((j) => (
                  <tr key={j.job} className="h-10 border-b border-line" title={j.lastError ?? undefined}>
                    <td className={tdFirst}>{humanize(j.job)}</td>
                    <td className={td}>
                      <Status s={j.status} />
                    </td>
                    <td className={`num ${td} text-right`}>{fmt('count', j.runs24h)}</td>
                    <td className={`num ${td} text-right`}>{fmt('count', j.failed24h)}</td>
                    <td className={`${tdLast} whitespace-nowrap text-ink-secondary`} title={new Date(j.lastStartedAt).toLocaleString('en-GB')}>{formatRelative(j.lastStartedAt)}</td>
                  </tr>
                ))}
              </Table>
              <p className="mt-3 flex items-center gap-2 text-[13px]">
                Partner credits: <Status s={d.partnerCredits.status} /> {fmt('count', d.partnerCredits.waiting)} waiting, {fmt('count', d.partnerCredits.failed)} failed
                {d.partnerCredits.oldestWaitingAt && `, oldest ${formatRelative(d.partnerCredits.oldestWaitingAt)}`}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px]" title={d.saleSplits.sample?.length ? `Payments: ${d.saleSplits.sample.join(', ')}` : undefined}>
                Sales reported:{' '}
                {!d.saleSplits.checked ? (
                  <span className="text-ink-muted">{d.saleSplits.reason ?? 'not checked'}</span>
                ) : (
                  <>
                    <Status s={(d.saleSplits.missing ?? 0) > 0 ? 'degraded' : 'operational'} /> {fmt('count', (d.saleSplits.payments ?? 0) - (d.saleSplits.missing ?? 0))} of {fmt('count', d.saleSplits.payments ?? 0)} (7 days)
                    {!!d.saleSplits.missing && `; ${fmt('count', d.saleSplits.missing)} missing, oldest ${d.saleSplits.oldestMissingAt ? formatRelative(d.saleSplits.oldestMissingAt) : ''}`}
                  </>
                )}
              </p>
            </>
          )}
        </Section>
      </div>

      <Panel title="Integrations" info="Payment providers: last hour; degraded with no success in 30 minutes or success below 80%. SMS: last 24 hours. RabbitMQ: management API.">
        <div className={quiet ? 'grid grid-cols-1 gap-5 lg:grid-cols-3' : 'flex flex-col gap-5'}>
          <Sub title="Payment providers" q={providers}>
            {(d) =>
              !d.payments.length ? (
                <InlineEmpty>No payments in the last hour.</InlineEmpty>
              ) : (
              <Table minWidth={560} head={['Provider', 'Status', { label: 'Attempts', align: 'right' }, { label: 'Success', align: 'right' }, { label: 'p95', align: 'right' }, 'Last success']}>
                {d.payments.map((p) => (
                  <tr key={p.gateway} className="h-10 border-b border-line">
                    <td className={tdFirst}>{humanize(p.gateway)}</td>
                    <td className={td}>
                      <Status s={p.status} />
                    </td>
                    <td className={`num ${td} text-right`}>{fmt('count', p.attempts)}</td>
                    <td className={`num ${td} text-right`}>{fmt('ratio', p.successRate)}</td>
                    <td className={`num ${td} text-right`}>{p.p95Seconds === null ? '–' : `${Math.round(p.p95Seconds)} s`}</td>
                    <td className={`${tdLast} text-ink-secondary`}>{p.lastSuccessAt ? formatRelative(p.lastSuccessAt) : 'None'}</td>
                  </tr>
                ))}
              </Table>
              )
            }
          </Sub>
          <Sub title="SMS gateways" q={providers}>
            {(d) =>
              !d.sms.length ? (
                <InlineEmpty>No SMS in the last 24 hours.</InlineEmpty>
              ) : (
              <Table minWidth={460} head={['Gateway', { label: 'Sent', align: 'right' }, { label: 'Failed', align: 'right' }, 'Last sent']}>
                {d.sms.map((x) => (
                  <tr key={x.gateway} className="h-10 border-b border-line">
                    <td className={tdFirst}>{humanize(x.gateway)}</td>
                    <td className={`num ${td} text-right`}>{fmt('count', x.sent)}</td>
                    <td className={`num ${td} text-right ${x.failRate && x.failRate > 0.1 ? 'text-ember-ink' : ''}`}>
                      {fmt('count', x.failed)} ({fmt('ratio', x.failRate)})
                    </td>
                    <td className={`${tdLast} text-ink-secondary`}>{x.lastAt ? formatRelative(x.lastAt) : '–'}</td>
                  </tr>
                ))}
              </Table>
              )
            }
          </Sub>
          <Sub title="RabbitMQ" q={rabbit}>
            {(d) =>
              !d.configured ? (
                <InlineEmpty>
                  Not connected. <InfoTip label="Setup">Setup: add RABBITMQ_USER and RABBITMQ_PASSWORD (same as the other services) to the admin service.</InfoTip>
                </InlineEmpty>
              ) : (
            <Table minWidth={620} head={['Queue', 'Status', { label: 'Depth', align: 'right' }, { label: 'Unacked', align: 'right' }, { label: 'Consumers', align: 'right' }, { label: 'In/s', align: 'right' }, { label: 'Out/s', align: 'right' }]}>
              {d.items.map((x) => (
                <tr key={x.name} className="h-10 border-b border-line">
                  <td className={`${tdFirst} font-mono text-[12px]`}>{x.name}</td>
                  <td className={td}>
                    <Status s={x.status} />
                  </td>
                  <td className={`num ${td} text-right`}>{fmt('count', x.depth)}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', x.unacked)}</td>
                  <td className={`num ${td} text-right`}>{x.consumers}</td>
                  <td className={`num ${td} text-right`}>{x.publishRate.toFixed(1)}</td>
                  <td className={`num ${tdLast} text-right`}>{x.deliverRate.toFixed(1)}</td>
                </tr>
              ))}
            </Table>
              )
            }
          </Sub>
        </div>
      </Panel>
    </div>
  );
}

function Alerts() {
  const q = useHealth<{ notifying: { slack: boolean; webhook: boolean }; items: { key: string; firing: boolean; title: string; detail: string | null; severity: 'critical' | 'warning'; since: string; resolvedAt: string | null }[] }>('/health/alerts', [], 60_000);
  const firing = (q.data?.items.filter((a) => a.firing) ?? []).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));
  const resolved = q.data?.items.filter((a) => !a.firing).slice(0, 5) ?? [];
  if (q.isLoading) return <Skeleton className="h-16 w-full" />;
  if (q.error || !q.data) return null;
  const where = [q.data.notifying.slack && 'Slack', q.data.notifying.webhook && 'the alert webhook'].filter(Boolean).join(' and ');
  const critical = firing.filter((a) => a.severity === 'critical').length;
  const warning = firing.length - critical;
  return (
    <section aria-label="Alerts" className={firing.length ? 'rounded-panel bg-ember-wash p-5' : 'rounded-panel bg-canvas p-5'}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="display text-[16px] text-ink">
          {firing.length ? [critical && `${critical} critical`, warning && `${warning} ${warning === 1 ? 'warning' : 'warnings'}`].filter(Boolean).join(', ') : 'All clear'}
        </h2>
        <InfoTip label="Setup">{`Checked every 5 minutes. ${where ? `Sent to ${where}.` : 'Setup: set ALERT_SLACK_WEBHOOK_URL or ALERT_WEBHOOK_URL in the admin service to send alerts.'}`}</InfoTip>
      </div>
      {!!firing.length && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {firing.map((a) => (
            <li key={a.key} className="flex flex-wrap items-center gap-2 text-[13px]">
              <StatusBadge status={a.severity === 'critical' ? 'critical' : 'warning'}>{a.severity === 'critical' ? 'Critical' : 'Warning'}</StatusBadge>
              <span className="text-ink" title={a.detail ?? undefined}>
                {a.title}
              </span>
              <span className="text-ink-muted">since {formatRelative(a.since)}</span>
            </li>
          ))}
        </ul>
      )}
      {!!resolved.length && (
        <details className="mt-3 text-[12px] text-ink-secondary">
          <summary className="cursor-pointer">Recently resolved</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {resolved.map((a) => (
              <li key={a.key}>
                {a.title}, resolved {a.resolvedAt ? formatRelative(a.resolvedAt) : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** A titled block inside a panel. */
function Sub<T>({ title, q, children }: { title: string; q: { isLoading: boolean; error: unknown; data?: T; refetch: () => unknown }; children: (d: T) => React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-ink">{title}</h3>
      {q.isLoading ? <Skeleton className="h-10 w-full" /> : q.error && !q.data ? <ErrorState what={title.toLowerCase()} message={(q.error as Error).message} onRetry={() => q.refetch()} /> : q.data ? children(q.data) : null}
    </div>
  );
}

function ServiceRow({ x, open, onToggle, onRoutes }: { x: Svc; open: boolean; onToggle: () => void; onRoutes: () => void }) {
  const none = x.requests === 0 && x.key !== 'admin';
  return (
    <>
      <tr className="h-11 cursor-pointer border-b border-line hover:bg-fog" onClick={onToggle}>
        <td className={tdFirst}>
          <button type="button" aria-expanded={open} className="display text-[15px] text-ink" onClick={(e) => (e.stopPropagation(), onToggle())}>
            {x.label}
          </button>
        </td>
        <td className={td}>
          <Status s={x.status} />
        </td>
        <td className={`num ${td} text-right`}>{x.key === 'admin' || none ? '–' : x.perMinute.toFixed(1)}</td>
        <td className={`num ${td} text-right`}>{none || x.errorRate === null ? '–' : fmt('ratio', x.errorRate)}</td>
        <td className={`num ${td} text-right`}>{ms(x.p95)}</td>
        <td className={`${tdLast} whitespace-nowrap text-ink-secondary`}>{x.lastRequestAt ? formatRelative(x.lastRequestAt) : 'Never'}</td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-fog">
          <td colSpan={6} className="px-6 py-3 text-[12px] text-ink-secondary">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {!x.reachable && <span className="text-ember-ink">Not reachable: {x.probeError}</span>}
              <span className="num">p50 {ms(x.p50)}</span>
              <span className="num">p99 {ms(x.p99)}</span>
              <span className="num">{fmt('count', x.requests)} requests</span>
              {x.key !== 'admin' && (
                <button type="button" className="underline underline-offset-4" onClick={onRoutes}>
                  Show its routes
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
