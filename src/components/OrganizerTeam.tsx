'use client';

import { PencilSimple, UserPlus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { useCan } from '@/app/(console)/me-context';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { AccountPicker } from './AccountPicker';
import { Avatar } from './Avatar';
import { RowLink, SearchForm } from './directory-ui';
import { Modal } from './Modal';
import { toast } from './Toaster';
import { PagerBar, useOffsetPager } from './pager';
import { Button, Field, inputClass, Panel, Skeleton, Tag } from './ui';

interface Role {
  id: number;
  name: string;
  immutable: boolean | null;
  assignable: boolean;
  members: number;
  permissions: number;
}
interface Member {
  id: number;
  userId: number | null;
  name: string | null;
  email: string | null;
  isOwner: boolean;
  isActive: boolean;
  joinedAt: string;
  roles: { id: number; name: string }[];
  imageUrl: string | null;
}
interface TeamPage {
  members: Member[];
  hasMore: boolean;
  total: number;
}

/**
 * An organizer's team: search, pages, and (organizers.team) inviting someone or changing a member's roles on the
 * organizer's behalf. Both go through the events service, ask for a reason and are audited.
 */
export function OrganizerTeam({ organizerId }: { organizerId: number }) {
  const canManage = useCan('organizers.team');
  const [q, setQ] = useState<string | null>(null);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    return p;
  }, [q]);
  const pager = useOffsetPager<Member, TeamPage>(`/organizers/${organizerId}/team`, params, (r) => ({ items: r.members, hasMore: r.hasMore, total: r.total }), { initialSize: 10 });
  const roles = useQuery({ queryKey: ['org-roles', organizerId], queryFn: () => api<{ roles: Role[] }>(`/organizers/${organizerId}/roles`) });
  const invites = useQuery({ queryKey: ['org-invites', organizerId], queryFn: () => api<{ invitations: { id: number; email: string; roles: number[]; createdAt: string }[] }>(`/organizers/${organizerId}/invitations`) });
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const roleName = (id: number) => roles.data?.roles.find((r) => r.id === id)?.name ?? `Role #${id}`;

  return (
    <Panel
      title="Team"
      freshness={pager.total != null ? `${pager.total.toLocaleString('en')} ${pager.total === 1 ? 'person' : 'people'}` : undefined}
      busy={pager.isFetching && !pager.isLoading}
      actions={
        canManage ? (
          <Button variant="secondary" icon={<UserPlus size={16} aria-hidden />} onClick={() => setInviting(true)}>
            Invite
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3">
        <SearchForm id={`team-q-${organizerId}`} label="Search the team" placeholder="Name, email or role" initial="" onSearch={setQ} />
      </div>
      {pager.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !pager.items.length ? (
        <p className="py-2 text-[13px] text-ink-muted">{q ? `No one matches “${q}”.` : 'No team members.'}</p>
      ) : (
        <ul className="hover-list flex flex-col">
          {pager.items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13px] last:border-b-0">
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar src={m.imageUrl} name={m.name ?? (m.userId ? `#${m.userId}` : m.email)} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{m.userId ? <RowLink href={`/users/${m.userId}`}>{m.name ?? `#${m.userId}`}</RowLink> : (m.name ?? 'Invited')}</span>
                  <span className="block truncate text-[12px] text-ink-muted">
                    {[m.email, m.isActive ? null : 'inactive', `joined ${formatRelative(m.joinedAt)}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {m.isOwner && <Tag>Owner</Tag>}
                {m.roles.filter((r) => !(m.isOwner && r.name === 'Owner')).map((r) => (
                  <Tag key={r.id}>{r.name}</Tag>
                ))}
                {!m.isOwner && !m.roles.length && <span className="text-[12px] text-ink-muted">No role</span>}
                {canManage && !m.isOwner && (
                  <button type="button" onClick={() => setEditing(m)} className="ml-1 inline-flex size-8 cursor-pointer items-center justify-center rounded-tag text-ink-secondary hover:bg-fog hover:text-ink" aria-label={`Change roles of ${m.name ?? m.email ?? 'member'}`}>
                    <PencilSimple size={15} aria-hidden />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <PagerBar pager={pager} noun="people" sizes={[10, 25, 50]} />
      {!!invites.data?.invitations.length && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[12px] font-medium text-ink-secondary">Waiting for an answer</p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {invites.data.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-ink">{i.email}</span>
                <span className="shrink-0 text-[12px] text-ink-muted">
                  {i.roles.length ? i.roles.map(roleName).join(', ') : 'No role'} · {formatRelative(i.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {inviting && <InviteDialog organizerId={organizerId} roles={roles.data?.roles ?? []} onClose={() => setInviting(false)} />}
      {editing && <RolesDialog organizerId={organizerId} member={editing} roles={roles.data?.roles ?? []} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function RolePicker({ roles, value, onChange, name }: { roles: Role[]; value: number[]; onChange: (v: number[]) => void; name: string }) {
  const assignable = roles.filter((r) => r.assignable);
  if (!assignable.length) return <p className="text-[13px] text-ink-muted">This organization has no roles to give yet.</p>;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-medium text-ink-secondary">Roles</legend>
      {assignable.map((r) => {
        const on = value.includes(r.id);
        return (
          <label key={r.id} className={clsx('flex cursor-pointer items-center justify-between gap-3 border px-3 py-2.5 text-[14px] hover:bg-fog', on ? 'border-ink' : 'border-line-strong')}>
            <span className="flex items-center gap-2">
              <input type="checkbox" name={name} checked={on} onChange={() => onChange(on ? value.filter((x) => x !== r.id) : [...value, r.id])} />
              {r.name}
            </span>
            <span className="text-[12px] text-ink-muted">
              {r.permissions} permission{r.permissions === 1 ? '' : 's'} · {r.members} {r.members === 1 ? 'person' : 'people'}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function InviteDialog({ organizerId, roles, onClose }: { organizerId: number; roles: Role[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ email: string; roleIds: number[]; reason: string }>({ email: '', roleIds: [], reason: '' });
  const m = useMutation({
    mutationFn: () => api<{ emailSent?: boolean; emailError?: string | null }>(`/organizers/${organizerId}/team/invite`, { method: 'POST', json: f }),
    meta: { silent: true },
    onSuccess: (r) => {
      toast(r?.emailSent === false ? `Invitation saved, but the email to ${f.email} failed${r.emailError ? ` (${r.emailError})` : ''}` : `Invitation emailed to ${f.email}`);
      qc.invalidateQueries({ queryKey: ['org-invites', organizerId] });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title="Invite to the team" description="They get the organization's usual invitation email and accept it in the Sinc app. The roles below are given when they accept." width="max-w-[560px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <AccountPicker id="ti-find" onPick={(a) => setF((x) => ({ ...x, email: a.email }))} />
        <Field label="Email" htmlFor="ti-email">
          <input id="ti-email" type="email" required className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@example.com" />
        </Field>
        <RolePicker roles={roles} value={f.roleIds} onChange={(roleIds) => setF({ ...f, roleIds })} name="ti-role" />
        <Field label="Reason (audit log)" htmlFor="ti-reason">
          <input id="ti-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Owner asked us to add their accountant" />
        </Field>
        {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={m.isPending} disabled={!f.email || f.reason.trim().length < 5}>
            Send invitation
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RolesDialog({ organizerId, member, roles, onClose }: { organizerId: number; member: Member; roles: Role[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<{ roleIds: number[]; reason: string }>({ roleIds: member.roles.map((r) => r.id).filter((id) => roles.find((x) => x.id === id)?.assignable), reason: '' });
  const m = useMutation({
    mutationFn: () => api(`/organizers/${organizerId}/team/${member.id}/roles`, { method: 'PUT', json: f }),
    meta: { success: 'Roles updated' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/organizers/${organizerId}/team`] });
      qc.invalidateQueries({ queryKey: ['org-roles', organizerId] });
      onClose();
    },
  });
  const same = [...f.roleIds].sort().join(',') === member.roles.map((r) => r.id).filter((id) => roles.find((x) => x.id === id)?.assignable).sort().join(',');
  return (
    <Modal open onClose={onClose} title={`Roles of ${member.name ?? member.email ?? 'this member'}`} description="Their permissions in the organization are rebuilt from the roles you leave ticked. Takes effect right away." width="max-w-[560px]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <RolePicker roles={roles} value={f.roleIds} onChange={(roleIds) => setF({ ...f, roleIds })} name="tr-role" />
        {!f.roleIds.length && <p className="text-[12px] text-ink-muted">With no role they stay in the team but can't do anything in the organization.</p>}
        <Field label="Reason (audit log)" htmlFor="tr-reason">
          <input id="tr-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Owner asked to make them an admin" />
        </Field>
        {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={m.isPending} disabled={same || f.reason.trim().length < 5}>
            Save roles
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
