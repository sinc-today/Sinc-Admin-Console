'use client';

import { Avatar } from '@/components/Avatar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ListSearch, PagerBar, useSearchPager } from '@/components/pager';
import { Modal } from '@/components/Modal';
import { NoAccess } from '@/components/PhasePlaceholder';
import { dayFmt, Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { Button, ErrorState, Field, InfoTip, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

interface Member {
  id: number;
  name: string;
  email: string;
  imageUrl?: string | null;
  role: string | null;
  roleName: string;
  status: string;
  twoFactor: boolean;
  lastLoginAt: string | null;
  isMe: boolean;
}
interface TeamData {
  items: Member[];
  roles: { key: string; name: string; description: string }[];
}

/** The partner owner manages who on their team can sign in, and with which partner role. */
export default function MarketTeamPage() {
  const can = useCan('market.team.manage');
  const sp = useSearchParams();
  const partnerId = sp.get('partnerId');
  const suffix = partnerId ? `?partnerId=${partnerId}` : '';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['market-team', partnerId], queryFn: () => api<TeamData>(`/market/team${suffix}`), enabled: can });
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['market-team'] });
  const changeRole = useMutation({
    mutationFn: (v: { id: number; role: string }) => api(`/market/team/${v.id}${suffix}`, { method: 'PATCH', json: { role: v.role } }),
    meta: { success: 'Role changed' },
    onSuccess: refresh,
  });
  const active = useMemo(() => (q.data?.items ?? []).filter((m) => m.status === 'ACTIVE'), [q.data]);
  const { pager, q: search, setQ: setSearch } = useSearchPager(active, (m) => `${m.name} ${m.email} ${m.role ?? ''}`, 25);
  if (!can) return <NoAccess />;
  const roles = q.data?.roles ?? [];
  const former = (q.data?.items ?? []).filter((m) => m.status !== 'ACTIVE');

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Team"
        freshness={q.data ? `${active.length} with access` : undefined}
        info="Everyone signs in with their own Sinc account and two-factor code. They only see your countries. Only the Sinc team can allow organizer withdrawals."
        actions={
          <>
            <RoleLegend roles={roles} />
            <Button className="h-9 px-3 text-[14px]" onClick={() => setInviting(true)}>
              Invite
            </Button>
          </>
        }
      >
        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : q.error ? (
          <ErrorState what="your team" message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : (
          <>
          <div className="mb-4">
            <ListSearch id="mteam-q" value={search} onChange={setSearch} placeholder="Name, email or role" label="Search your team" />
          </div>
          <Table minWidth={720} head={['Name', 'Role', 'Two-factor', 'Last sign-in', '']}>
            {pager.items.map((m) => (
              <tr key={m.id} className="h-12 border-b border-line">
                <td className={tdFirst}>
                  <div className="flex items-center gap-3">
                    <Avatar src={m.imageUrl} name={m.name} size={32} />
                    <div className="min-w-0">
                      <span className="text-ink">{m.name}</span>
                      {m.isMe && <span className="ml-1.5 text-[12px] text-ink-muted">(you)</span>}
                      <div className="text-[12px] text-ink-muted">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className={td}>
                  <label htmlFor={`role-${m.id}`} className="sr-only">
                    Role for {m.name}
                  </label>
                  <select
                    id={`role-${m.id}`}
                    className={`${inputClass} h-9 w-[160px]`}
                    value={m.role ?? ''}
                    disabled={m.isMe || changeRole.isPending}
                    onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}
                    title={m.isMe ? "You can't change your own role" : 'Changing a role signs them out'}
                  >
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={td}>{m.twoFactor ? <StatusBadge status="ok">Set up</StatusBadge> : <StatusBadge status="pending">Not yet</StatusBadge>}</td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{m.lastLoginAt ? dayFmt(m.lastLoginAt) : 'Never'}</td>
                <td className={`${tdLast} text-right`}>
                  {!m.isMe && (
                    <Button variant="quiet" onClick={() => setRemoving(m)}>
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {!pager.items.length && search && <p className="py-2 text-[13px] text-ink-muted">No one matches “{search}”.</p>}
          <PagerBar pager={pager} noun="people" />
          </>
        )}
        {changeRole.error && <p className="mt-2 text-[12px] text-ember-ink">{(changeRole.error as Error).message}</p>}
        {former.length > 0 && (
          <details className="mt-4 text-[13px] text-ink-secondary">
            <summary className="cursor-pointer">Former members ({former.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {former.map((m) => (
                <li key={m.id}>
                  {m.name} <span className="text-ink-muted">{m.email}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
      <InviteModal open={inviting} onClose={() => setInviting(false)} roles={roles} suffix={suffix} onDone={refresh} />
      <RemoveModal member={removing} onClose={() => setRemoving(null)} suffix={suffix} onDone={refresh} />
    </div>
  );
}

function RoleLegend({ roles }: { roles: TeamData['roles'] }) {
  if (!roles.length) return null;
  return (
    <InfoTip label="What each role can do">
      <span className="flex flex-col gap-1.5">
        {roles.map((r) => (
          <span key={r.key}>
            <strong className="font-medium text-ink">{r.name}:</strong> {r.description}
          </span>
        ))}
      </span>
    </InfoTip>
  );
}

function InviteModal({ open, onClose, roles, suffix, onDone }: { open: boolean; onClose: () => void; roles: TeamData['roles']; suffix: string; onDone: () => void }) {
  const [f, setF] = useState({ email: '', name: '', role: 'partner_owner' });
  const [result, setResult] = useState<{ accountCreated: boolean; emailSent: boolean; emailError: string | null } | null>(null);
  const m = useMutation({
    mutationFn: () => api<{ accountCreated: boolean; emailSent: boolean; emailError: string | null }>(`/market/team${suffix}`, { method: 'POST', json: { email: f.email, name: f.name || null, role: f.role } }),
    meta: { success: 'Invitation sent' },
    onSuccess: (r) => {
      setResult(r);
      onDone();
    },
  });
  const close = () => {
    setResult(null);
    setF({ email: '', name: '', role: 'partner_owner' });
    m.reset();
    onClose();
  };
  const desc = roles.find((r) => r.key === f.role)?.description;
  return (
    <Modal open={open} onClose={close} title="Invite to your team" width="max-w-[520px]">
      {result ? (
        <div className="flex flex-col gap-4">
          <p role="status" className={`text-[14px] ${result.emailSent ? 'text-ink' : 'text-ember-ink'}`}>
            {result.emailSent
              ? result.accountCreated
                ? `${f.email} now has access. We created their Sinc account and emailed them a password.`
                : `${f.email} now has access. They sign in with their existing Sinc account.`
              : `${f.email} has access, but the email failed (${result.emailError ?? 'unknown error'}). Ask them to use "Forgot password" on the sign-in page.`}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setResult(null)}>Invite another</Button>
            <Button variant="secondary" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <Field label="Email" htmlFor="ti-email" helper="No Sinc account yet? One is created and a password emailed to them.">
            <input id="ti-email" type="email" required className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@company.com" />
          </Field>
          <Field label="Name" htmlFor="ti-name">
            <input id="ti-name" className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Optional" />
          </Field>
          <Field label="Role" htmlFor="ti-role" helper={desc}>
            <select id="ti-role" className={inputClass} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={m.isPending} loadingText="Inviting…" disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)}>
              Send invitation
            </Button>
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function RemoveModal({ member, onClose, suffix, onDone }: { member: Member | null; onClose: () => void; suffix: string; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/market/team/${member!.id}/remove${suffix}`, { method: 'POST', json: { reason: reason || undefined } }),
    meta: { success: 'Access removed' },
    onSuccess: () => {
      setReason('');
      onDone();
      onClose();
    },
  });
  return (
    <Modal open={!!member} onClose={onClose} title={member ? `Remove ${member.name}` : 'Remove'} width="max-w-[480px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <p className="text-[13px] text-ink-secondary">They are signed out straight away and can no longer open your dashboard.</p>
        <Field label="Reason" htmlFor="tr-reason">
          <input id="tr-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional, e.g. Left the company" />
        </Field>
        {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={m.isPending}>
            Remove access
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
