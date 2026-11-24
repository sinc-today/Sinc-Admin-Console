'use client';

import { Avatar } from './Avatar';
import { SidePane } from './SidePane';

import { ArrowSquareOut, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useCan } from '@/app/(console)/me-context';
import { fmt, humanize } from './analytics-ui';
import { CountryCode, RowLink, dayFmt } from './directory-ui';
import { PagerBar, useCursorPager } from './pager';
import { TxStatus } from './TxStatus';
import { ResendTicketsButton } from './ResendTickets';
import { ErrorState, Skeleton, StatusBadge, Tag } from './ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';

interface UserDetail {
  user: {
    id: number;
    username: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    piiFull: boolean;
    hasPhone: boolean;
    gender: string | null;
    dateOfBirth: string | null;
    bio: string | null;
    imageUrl?: string | null;
    registrationMethod: string | null;
    accountType: string | null;
    isBlocked: boolean;
    isVerified: boolean;
    isActive: boolean;
    isPrivate: boolean;
    isUserOnboarded: boolean;
    isOrganizerOnboarded: boolean;
    twoFAenabled: boolean;
    pushNotification: boolean | null;
    createdAt: string;
    roles: string[];
  };
  presence: { lastSeenAt: string; platform: string | null; service: string | null; country: string | null } | null;
  devices: { deviceName: string | null; allowPushNotification: boolean | null; lastUsed: string | null; updatedAt: string | null }[];
  locationConsent: { locationEnabled: boolean | null; locationVisibility: string | null } | null;
  geo: { resolved: { accessCountry: string | null; accessCountryName: string | null; homeCountry: string | null; homeCountryName: string | null; vpnSuspected: boolean; roaming: boolean } };
  activity: { day: string }[];
  tickets: { n: number; paid: number; scanned: number };
  payments: { totals: { currency: string; ok: number; failed: number; amount: number }[] };
  organizers: { id: number; name: string | null; isOwner: boolean }[];
  audit: { id: string; occurred_at: string; action: string; reason: string | null }[];
}

const PLATFORM: Record<string, string> = { ios: 'iOS app', android: 'Android app', web: 'Web' };

/** Opens over any console page when the URL has `?user=<id>`; Esc, the close button or a click outside removes it. */
export function UserPane() {
  const can = useCan('users.read');
  const [userId, setUserId] = useQueryState('user', parseAsInteger);
  const open = !!userId && can;
  return (
    <SidePane open={open} onClose={() => setUserId(null)} label="User details">
      <PaneBody id={userId!} onClose={() => setUserId(null)} />
    </SidePane>
  );
}

function PaneBody({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['user', String(id)], queryFn: () => api<UserDetail>(`/users/${id}`) });
  const d = q.data;
  const u = d?.user;
  return (
    <div className="flex min-h-full flex-col gap-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          {u && <Avatar src={u.imageUrl} name={u.name || u.username} size={64} />}
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink-secondary">User #{id}</p>
            <h2 className="display truncate text-[32px] leading-tight text-ink">{u ? u.name || u.username : 'Loading…'}</h2>
            {u && (
              <p className="text-[13px] text-ink-secondary">
                @{u.username} · joined {dayFmt(u.createdAt)}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/users/${id}`} onClick={onClose} className="inline-flex h-9 items-center gap-1.5 bg-canvas px-3 text-[13px] font-medium outline outline-1 outline-line-strong hover:bg-fog">
            Full page <ArrowSquareOut size={14} aria-hidden />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-9 items-center justify-center bg-canvas outline outline-1 outline-line-strong hover:bg-fog" autoFocus>
            <X size={16} aria-hidden />
          </button>
        </div>
      </header>

      {q.isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : q.error ? (
        <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
      ) : d && u ? (
        <>
          <div className="flex flex-wrap gap-2">
            {u.isBlocked && <StatusBadge status="critical">Blocked</StatusBadge>}
            {u.isVerified && <StatusBadge status="ok">Verified</StatusBadge>}
            {!u.isActive && <StatusBadge status="warning">Deactivated</StatusBadge>}
            {d.geo.resolved.vpnSuspected && <StatusBadge status="warning">Likely VPN</StatusBadge>}
            {u.twoFAenabled && <Tag>2FA on</Tag>}
            {u.isPrivate && <Tag>Private profile</Tag>}
            {u.roles.map((r) => (
              <Tag key={r} tone="brass">
                {r}
              </Tag>
            ))}
          </div>

          <Section title="Contact">
            <Grid
              rows={[
                ['Email', u.email ?? 'None'],
                ['Phone', u.phone ?? 'None'],
              ]}
            />
            <p className="mt-2 text-[12px] text-ink-muted">
              {u.piiFull ? 'Shown in full for your role. This view is recorded in the audit log.' : 'Masked for your role. Reveal with a reason on the full page.'}
            </p>
          </Section>

          <Section title="Activity">
            <Grid
              rows={[
                [
                  'Last seen',
                  d.presence ? (
                    <span>
                      {Date.now() - new Date(d.presence.lastSeenAt).getTime() < 5 * 60_000 && <span aria-hidden className="mr-1.5 inline-block size-2 rounded-pill bg-ember" />}
                      {formatRelative(d.presence.lastSeenAt)}
                      {d.presence.platform && PLATFORM[d.presence.platform] && <span className="text-ink-muted"> · {PLATFORM[d.presence.platform]}</span>}
                    </span>
                  ) : (
                    'Not seen since tracking started'
                  ),
                ],
                ['Active days (60 days)', String(d.activity.length)],
                ['Accessing from', <CountryCode key="ac" code={d.geo.resolved.accessCountry} name={d.geo.resolved.accessCountryName} />],
                ['Home country', <CountryCode key="hc" code={d.geo.resolved.homeCountry} name={d.geo.resolved.homeCountryName} />],
              ]}
            />
          </Section>

          <Section title="Profile">
            <Grid
              rows={[
                ['Sign-in', u.registrationMethod === 'MANUAL' ? 'Email and password' : humanize(u.registrationMethod)],
                ['Account', humanize(u.accountType)],
                ['Date of birth', u.dateOfBirth ? dayFmt(u.dateOfBirth) : 'Not given'],
                ['Gender', u.gender ? humanize(u.gender) : 'Not given'],
                ['Onboarded', u.isUserOnboarded ? 'Yes' : 'No'],
                ['Organizer onboarded', u.isOrganizerOnboarded ? 'Yes' : 'No'],
                ['Push notifications', u.pushNotification === false ? 'Off' : 'On'],
                ['Location sharing', d.locationConsent?.locationEnabled ? `On (${humanize(d.locationConsent.locationVisibility)})` : 'Off'],
              ]}
            />
            {u.bio && <p className="mt-3 text-[13px] text-ink-secondary">{u.bio}</p>}
          </Section>

          <Section title={`Devices (${d.devices.length})`}>
            {d.devices.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No devices registered.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {d.devices.map((dv, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="truncate">{dv.deviceName ?? 'Unknown device'}</span>
                    <span className="shrink-0 text-ink-muted">
                      {dv.lastUsed ? `used ${formatRelative(dv.lastUsed)}` : 'never used'} · push {dv.allowPushNotification ? 'on' : 'off'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {d.organizers.length > 0 && (
            <Section title="Organizer access">
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {d.organizers.map((o) => (
                  <li key={o.id}>
                    <RowLink href={`/organizers/${o.id}`}>{o.name ?? `Organizer #${o.id}`}</RowLink>
                    <span className="ml-2 text-ink-muted">{o.isOwner ? 'owner' : 'member'}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <PanePayments id={id} totals={d.payments.totals} />
          <PaneTickets id={id} counts={d.tickets} />

          {d.audit.length > 0 && (
            <Section title="Staff actions">
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {d.audit.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    {humanize(a.action.replace('.', '_'))} <span className="text-ink-muted">· {formatDateTime(a.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel bg-canvas p-4" aria-label={title}>
      <h3 className="display mb-3 text-[16px] leading-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(120px,40%)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-secondary">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const EMPTY = new URLSearchParams();

export function PanePayments({ id, totals }: { id: number; totals: UserDetail['payments']['totals'] }) {
  const p = useCursorPager<{ id: number; createdAt: string; amount: number; currency: string; status: string; transactionType: string }>(`/users/${id}/payments`, EMPTY, {
    urlSize: false,
    initialSize: 10,
  });
  return (
    <Section title="Payments">
      <p className="mb-2 text-[12px] text-ink-muted">
        {totals.length ? totals.map((t) => `${t.ok} successful (${fmt('money', t.amount, t.currency, true)}) · ${t.failed} failed`).join(' · ') : 'No payments'}
      </p>
      <ul className="hover-list flex flex-col">
        {p.items.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px]">
            <span className="min-w-0 truncate">
              <RowLink href={`/transactions/${t.id}`}>#{t.id}</RowLink>
              <span className="ml-2 text-ink-secondary">{humanize(t.transactionType)}</span>
              <span className="ml-2 text-ink-muted">{formatRelative(t.createdAt)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <TxStatus status={t.status} />
              <span className="num">{fmt('money', t.amount, t.currency)}</span>
            </span>
          </li>
        ))}
      </ul>
      <PagerBar pager={p} noun="payments" sizes={[10, 25, 50]} />
    </Section>
  );
}

export function PaneTickets({ id, counts }: { id: number; counts: UserDetail['tickets'] }) {
  const p = useCursorPager<{ id: number; eventId: number | null; eventName: string | null; ticketName: string | null; paidAmount: number | null; scanned: boolean }>(
    `/users/${id}/tickets`,
    EMPTY,
    { urlSize: false, initialSize: 10 }
  );
  return (
    <Section title="Tickets">
      <p className="mb-2 text-[12px] text-ink-muted">
        {counts.n} tickets · {counts.paid} paid · {counts.scanned} scanned
      </p>
      <ul className="hover-list flex flex-col">
        {p.items.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px]">
            <span className="min-w-0 truncate">
              {t.eventId ? <RowLink href={`/events/${t.eventId}`}>{t.eventName ?? `Event #${t.eventId}`}</RowLink> : 'Unknown event'}
              <span className="ml-2 text-ink-muted">{t.ticketName}</span>
            </span>
            <span className="num flex shrink-0 items-baseline gap-2 text-ink-secondary">
              {t.paidAmount ? t.paidAmount.toLocaleString('en') : 'Free'}
              {t.scanned && <span className="text-[12px]">scanned</span>}
              {t.eventId && <ResendTicketsButton eventId={t.eventId} eventName={t.eventName ?? `Event #${t.eventId}`} userId={id} variant="quiet" label="Resend" />}
            </span>
          </li>
        ))}
      </ul>
      <PagerBar pager={p} noun="tickets" sizes={[10, 25, 50]} />
    </Section>
  );
}
