'use client';

import { Avatar } from '@/components/Avatar';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { TxStatus } from '@/components/TxStatus';
import { fmt, humanize } from '@/components/analytics-ui';
import { CountryCode, Facts, RowLink, Table, dayFmt, td, tdFirst, tdLast } from '@/components/directory-ui';
import { Button, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { PanePayments, PaneTickets } from '@/components/UserPane';
import { useCan } from '../../me-context';

interface Signal {
  source: string;
  label: string;
  country: string | null;
  countryName: string | null;
  at: string | null;
  detail?: string | null;
}
interface User360 {
  user: {
    id: number;
    username: string;
    name: string | null;
    imageUrl?: string | null;
    email: string | null;
    phone: string | null;
    hasPhone: boolean;
    gender: string | null;
    registrationMethod: string | null;
    accountType: string | null;
    isBlocked: boolean;
    isVerified: boolean;
    isActive: boolean;
    isUserOnboarded: boolean;
    isOrganizerOnboarded: boolean;
    twoFAenabled: boolean;
    createdAt: string;
    roles: string[];
  };
  devices: { deviceName: string | null; allowPushNotification: boolean | null; updatedAt: string | null }[];
  locationConsent: { locationEnabled: boolean | null; locationVisibility: string | null } | null;
  geo: {
    resolved: {
      accessCountry: string | null;
      accessCountryName: string | null;
      accessSource: string | null;
      accessConfidence: 'high' | 'medium' | 'low' | null;
      homeCountry: string | null;
      homeCountryName: string | null;
      homeSource: string | null;
      vpnSuspected: boolean;
      roaming: boolean;
      notes: string[];
    };
    signals: Signal[];
    countries: { country: string; name: string; first_seen_at: string; last_seen_at: string; requests: number; last_source: string }[];
  };
  activity: { day: string; country: string | null }[];
  tickets: { n: number; paid: number; scanned: number; recent: { id: number; eventId: number | null; eventName: string | null; ticketName: string | null; paidAmount: number | null; scanned: boolean; createdAt: string }[] };
  payments: {
    totals: { currency: string; ok: number; failed: number; amount: number }[];
    recent: { id: number; createdAt: string; amount: number; currency: string; status: string; transactionType: string; correspondent: string | null }[];
  };
  organizers: { id: number; name: string | null; isOwner: boolean }[];
  audit: { id: string; occurred_at: string; action: string; reason: string | null; actor_role: string | null }[];
}

const SOURCE_LABEL: Record<string, string> = { gps: 'GPS', edge: 'network (edge)', ip: 'network (IP lookup)', sim: 'SIM network', phone: 'phone number', device: 'device settings' };

export default function UserPage() {
  const can = useCan('users.read');
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api<User360>(`/users/${id}`), enabled: can });
  if (!can) return <NoAccess />;
  if (q.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const u = d.user;
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-secondary">
        <Link href="/users" className="hover:underline">
          Users
        </Link>{' '}
        / <span className="text-ink">#{u.id}</span>
      </nav>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar src={u.imageUrl} name={u.name || u.username} size={72} />
            <div>
            <h2 className="display break-words text-[24px] leading-tight text-ink sm:text-[32px]">{u.name || u.username}</h2>
            <p className="mt-1 text-[13px] text-ink-secondary">
              @{u.username} · joined {dayFmt(u.createdAt)} · {u.registrationMethod === 'MANUAL' ? 'email and password' : humanize(u.registrationMethod)} · {humanize(u.accountType)} account
            </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {u.isBlocked && <StatusBadge status="critical">Blocked</StatusBadge>}
            {u.isVerified && <StatusBadge status="ok">Verified</StatusBadge>}
            {!u.isActive && <StatusBadge status="warning">Deactivated</StatusBadge>}
            {u.twoFAenabled && <Tag>2FA on</Tag>}
            {u.roles.map((r) => (
              <Tag key={r} tone="brass">
                {r}
              </Tag>
            ))}
          </div>
        </div>
        <div className="mt-6">
          <ContactFacts userId={u.id} email={u.email} phone={u.phone} hasPhone={u.hasPhone} />
        </div>
      </Panel>

      <LocationPanel d={d} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PaneTickets id={u.id} counts={d.tickets} />
        <PanePayments id={u.id} totals={d.payments.totals} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Organizer access">
          {d.organizers.length === 0 ? (
            <p className="text-[13px] text-ink-muted">Not a member of any organizer.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13px]">
              {d.organizers.map((o) => (
                <li key={o.id}>
                  <RowLink href={`/organizers/${o.id}`}>{o.name ?? `Organizer #${o.id}`}</RowLink>
                  <span className="ml-2 text-ink-muted">{o.isOwner ? 'owner' : 'member'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Devices">
          {d.devices.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No devices registered.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13px]">
              {d.devices.map((dv, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-ink">{dv.deviceName ?? 'Unknown device'}</span>
                  <span className="shrink-0 text-ink-muted">{dv.allowPushNotification ? 'push on' : 'push off'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Staff actions on this user">
          {d.audit.length === 0 ? (
            <p className="text-[13px] text-ink-muted">None.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[13px]">
              {d.audit.map((a) => (
                <li key={a.id}>
                  <span className="text-ink">{humanize(a.action.replace('.', '_'))}</span>
                  <span className="ml-2 text-ink-muted">{formatDateTime(a.occurred_at)}</span>
                  {a.reason && <p className="text-[12px] text-ink-secondary">{a.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ contact details with audited reveal */
function ContactFacts({ userId, email, phone, hasPhone }: { userId: number; email: string | null; phone: string | null; hasPhone: boolean }) {
  const canReveal = useCan('pii.reveal');
  const [revealed, setRevealed] = useState<{ email?: string; phone?: string }>({});
  const [asking, setAsking] = useState<'email' | 'phone' | null>(null);
  const [reason, setReason] = useState('');
  const reveal = useMutation({
    mutationFn: (field: 'email' | 'phone') => api<{ field: 'email' | 'phone'; value: string | null }>(`/users/${userId}/reveal`, { method: 'POST', json: { field, reason } }),
    onSuccess: (r) => {
      setRevealed((x) => ({ ...x, [r.field]: r.value ?? 'None' }));
      setAsking(null);
      setReason('');
    },
  });
  const cell = (field: 'email' | 'phone', masked: string | null, available: boolean) => (
    <span className="flex items-baseline gap-2">
      <span className="truncate">{revealed[field] ?? masked ?? 'None'}</span>
      {canReveal && available && !revealed[field] && (
        <button type="button" className="text-[12px] font-medium text-ink underline decoration-ember underline-offset-4" onClick={() => setAsking(field)}>
          Reveal
        </button>
      )}
    </span>
  );
  return (
    <>
      <Facts
        items={[
          { label: 'Email', value: cell('email', email, !!email) },
          { label: 'Phone', value: cell('phone', phone, hasPhone) },
          { label: 'User id', value: userId },
        ]}
        cols={3}
      />
      {asking && (
        <form
          className="mt-5 flex max-w-[640px] flex-col gap-3 bg-fog p-4"
          onSubmit={(e) => {
            e.preventDefault();
            reveal.mutate(asking);
          }}
        >
          <Field label={`Why do you need this ${asking === 'email' ? 'email address' : 'phone number'}?`} htmlFor="reveal-reason" helper="Recorded in the audit log with your name.">
            <input id="reveal-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="Support ticket number or reason" autoFocus />
          </Field>
          {reveal.error && <p className="text-[12px] text-ember-ink">{(reveal.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={reveal.isPending} disabled={reason.trim().length < 5}>
              Reveal and log
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAsking(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ location & access */
function LocationPanel({ d }: { d: User360 }) {
  const r = d.geo.resolved;
  const consent = d.locationConsent;
  const confidenceText = r.accessConfidence === 'high' ? 'High confidence' : r.accessConfidence === 'medium' ? 'Medium confidence' : r.accessConfidence === 'low' ? 'Low confidence' : null;
  const last60 = d.activity.length;
  return (
    <Panel title="Location and access" freshness="Countries only. Exact coordinates and IP addresses are never shown or stored by the console.">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[12px] font-medium text-ink-secondary">Accessing from</p>
            <p className="display mt-1 text-[32px] leading-tight text-ink">{r.accessCountryName ?? 'Not located yet'}</p>
            {r.accessSource && (
              <p className="mt-1 text-[13px] text-ink-secondary">
                From {SOURCE_LABEL[r.accessSource]}
                {confidenceText && ` · ${confidenceText}`}
              </p>
            )}
          </div>
          <div>
            <p className="text-[12px] font-medium text-ink-secondary">Home country</p>
            <p className="mt-1 text-[16px] text-ink">
              {r.homeCountryName ?? 'Unknown'}
              {r.homeSource && <span className="ml-2 text-[13px] text-ink-muted">from {SOURCE_LABEL[r.homeSource]}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {r.vpnSuspected && <StatusBadge status="warning">Likely VPN or proxy</StatusBadge>}
            {r.roaming && <StatusBadge status="info">Roaming</StatusBadge>}
            <Tag>{consent?.locationEnabled ? `Shares location (${humanize(consent.locationVisibility)})` : 'Location sharing off'}</Tag>
          </div>
          {r.notes.length > 0 && (
            <ul className="list-disc pl-5 text-[13px] text-ink-secondary">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-6">
          {d.geo.signals.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No location signals for this user yet. They appear after the user's next signed-in request.</p>
          ) : (
            <Table minWidth={460} head={['Signal', 'Country', 'Seen']}>
              {d.geo.signals.map((s) => (
                <tr key={s.source} className="h-10 border-b border-line">
                  <td className={`${tdFirst} text-ink-secondary`}>{s.label}</td>
                  <td className={td}>
                    {s.country ? <CountryCode code={s.country} name={s.countryName} /> : <span className="text-ink-muted">{s.detail ?? 'None'}</span>}
                    {s.country && s.detail && <span className="ml-2 text-[12px] text-ink-muted">{s.detail}</span>}
                  </td>
                  <td className={`num ${tdLast} whitespace-nowrap text-ink-muted`}>{s.at ? formatRelative(s.at) : s.country ? 'From profile' : ''}</td>
                </tr>
              ))}
            </Table>
          )}
          {d.geo.countries.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-medium text-ink">Countries this account connected from</h3>
              <ul className="hover-list flex flex-col">
                {d.geo.countries.map((c) => (
                  <li key={c.country} className="flex items-baseline justify-between gap-3 border-b border-line py-2 text-[13px]">
                    <CountryCode code={c.country} name={c.name} />
                    <span className="num text-ink-muted">
                      {c.requests.toLocaleString('en')} requests · last {formatRelative(c.last_seen_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-ink-muted">Active on {last60} of the last 60 days.</p>
        </div>
      </div>
    </Panel>
  );
}
