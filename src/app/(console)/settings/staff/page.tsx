'use client';

import { Avatar } from '@/components/Avatar';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListSearch, PagerBar, useSearchPager } from '@/components/pager';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { Button, EmptyState, ErrorState, Field, InfoTip, inputClass, Panel, Skeleton, StatusBadge, Tag } from '@/components/ui';
import * as Popover from '@radix-ui/react-popover';
import { Modal } from '@/components/Modal';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { useCan, useMe } from '../../me-context';

interface StaffRow {
  id: number;
  userId: number;
  displayName: string;
  email: string;
  imageUrl?: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  role: { key: string; name: string } | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export default function StaffPage() {
  const canRead = useCan('staff.read');
  const canManage = useCan('staff.manage');
  const staffQ = useQuery({ queryKey: ['staff'], queryFn: () => api<StaffRow[]>('/staff'), enabled: canRead });
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: () => api<RoleRow[]>('/roles'), enabled: canRead });

  if (!canRead) return <NoAccess />;

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Staff"
        freshness={staffQ.data ? `${staffQ.data.length} ${staffQ.data.length === 1 ? 'person' : 'people'}` : undefined}
        actions={
          <>
            {rolesQ.data && <RoleLegend roles={rolesQ.data} />}
            {canManage && rolesQ.data && <AddStaff roles={rolesQ.data} />}
          </>
        }
      >
        {staffQ.isLoading ? (
          <TableSkeleton />
        ) : staffQ.error ? (
          <ErrorState what="staff" message={staffQ.error.message} requestId={(staffQ.error as ApiError).requestId} onRetry={() => staffQ.refetch()} />
        ) : staffQ.data && staffQ.data.length > 0 ? (
          <StaffTable rows={staffQ.data} roles={rolesQ.data ?? []} canManage={canManage} />
        ) : (
          <EmptyState title="No staff yet" body="Add teammates once the first owner signs in." />
        )}
      </Panel>
    </div>
  );
}

/** What each role can do, in one popover instead of on the page. */
function RoleLegend({ roles }: { roles: RoleRow[] }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex h-9 items-center gap-2 px-3 text-[13px] font-medium text-ink outline outline-1 outline-line-strong hover:bg-fog">
        Roles
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 max-h-[70dvh] w-[min(92vw,440px)] overflow-y-auto border border-line-strong bg-canvas p-4" style={{ borderRadius: 0 }}>
          <p className="mb-2 flex items-center gap-1 text-[12px] text-ink-muted">
            Roles are defined in code. <InfoTip label="Where roles are defined">Change them in admin/src/rbac/permissions.ts; they sync on deploy.</InfoTip>
          </p>
          <ul className="flex flex-col">
            {roles.map((r) => (
              <li key={r.key} className="border-b border-line py-2.5">
                <p className="text-[14px] text-ink">{r.name}</p>
                <p className="text-[12px] text-ink-secondary">{r.description}</p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12px] text-ink-muted">{r.permissions.length} permissions</summary>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <Tag key={p}>{p}</Tag>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function StaffTable({ rows, roles, canManage }: { rows: StaffRow[]; roles: RoleRow[]; canManage: boolean }) {
  const me = useMe();
  const [editing, setEditing] = useState<number | null>(null);
  const { pager, q, setQ, matched } = useSearchPager(rows, (s) => `${s.displayName} ${s.email} ${s.role?.name ?? ''} ${s.status}`);
  return (
    <>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <ListSearch id="staff-q" value={q} onChange={setQ} placeholder="Name, email or role" label="Search staff" />
      {q && <span className="text-[12px] text-ink-muted">{matched} of {rows.length}</span>}
    </div>
    <div className="relative -mx-6 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-fog text-left text-[12px] font-medium text-ink-secondary">
            <th scope="col" className="h-10 px-6 font-medium">Name</th>
            <th scope="col" className="px-4 font-medium">Role</th>
            <th scope="col" className="px-4 font-medium">Status</th>
            <th scope="col" className="px-4 font-medium">Two-factor</th>
            <th scope="col" className="px-4 font-medium">Last sign-in</th>
            {canManage && <th scope="col" className="px-6 text-right font-medium"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {pager.items.map((s) => (
            <StaffRowView
              key={s.id}
              s={s}
              roles={roles}
              isMe={s.id === me.staff.id}
              canManage={canManage}
              editing={editing === s.id}
              onEdit={() => setEditing(editing === s.id ? null : s.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
    <PagerBar pager={pager} noun="staff" />
    </>
  );
}

function StaffRowView({
  s,
  roles,
  isMe,
  canManage,
  editing,
  onEdit,
}: {
  s: StaffRow;
  roles: RoleRow[];
  isMe: boolean;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      <tr className="h-12 border-b border-line hover:bg-fog">
        <td className="px-6">
          <div className="flex items-center gap-3">
            <Avatar src={s.imageUrl} name={s.displayName} size={32} />
            <div className="min-w-0">
              <p className="text-ink">
                {s.displayName} {isMe && <span className="text-ink-muted">(you)</span>}
              </p>
              <p className="text-[12px] text-ink-muted">{s.email}</p>
            </div>
          </div>
        </td>
        <td className="px-4 text-ink">{s.role?.name ?? 'None'}</td>
        <td className="px-4">
          {s.status === 'ACTIVE' ? <StatusBadge status="ok">Active</StatusBadge> : <StatusBadge status="warning">Suspended</StatusBadge>}
        </td>
        <td className="px-4">
          {s.mfaEnabled ? <StatusBadge status="ok">On</StatusBadge> : <StatusBadge status="pending">Not set up</StatusBadge>}
        </td>
        <td className="num px-4 text-ink-secondary" title={s.lastLoginAt ? formatDateTime(s.lastLoginAt) : undefined}>
          {s.lastLoginAt ? formatRelative(s.lastLoginAt) : 'Never'}
        </td>
        {canManage && (
          <td className="px-6 text-right">
            {!isMe && (
              <Button variant="quiet" onClick={onEdit} aria-expanded={editing}>
                {editing ? 'Close' : 'Edit'}
              </Button>
            )}
          </td>
        )}
      </tr>
      {editing && (
        <tr className="border-b border-line bg-ivory">
          <td colSpan={6} className="px-6 py-5">
            <EditStaff s={s} roles={roles} onDone={onEdit} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditStaff({ s, roles, onDone }: { s: StaffRow; roles: RoleRow[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [roleKey, setRoleKey] = useState(s.role?.key ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutate = useMutation({
    mutationFn: (body: Record<string, string>) =>
      body.kind === 'mfa'
        ? api(`/staff/${s.id}/reset-mfa`, { method: 'POST', json: { reason } })
        : api(`/staff/${s.id}`, { method: 'PATCH', json: { ...body, reason } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  const reasonOk = reason.trim().length >= 3;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-secondary">Changes sign {s.displayName} out of every session. A reason is recorded in the audit log.</p>
      <div className="grid max-w-[880px] grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <Field label="Role" htmlFor={`role-${s.id}`}>
          <select id={`role-${s.id}`} value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputClass}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason" htmlFor={`reason-${s.id}`} error={error ?? undefined} helper="For example: moved to the finance team">
          <input id={`reason-${s.id}`} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!reasonOk || roleKey === s.role?.key} loading={mutate.isPending} onClick={() => mutate.mutate({ roleKey })}>
          Change role
        </Button>
        <Button
          variant="secondary"
          disabled={!reasonOk}
          onClick={() => mutate.mutate({ status: s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
        >
          {s.status === 'ACTIVE' ? 'Suspend access' : 'Restore access'}
        </Button>
        {s.mfaEnabled && (
          <Button variant="secondary" disabled={!reasonOk} onClick={() => mutate.mutate({ kind: 'mfa' })}>
            Reset two-factor
          </Button>
        )}
      </div>
    </div>
  );
}

function AddStaff({ roles }: { roles: RoleRow[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleKey, setRoleKey] = useState('viewer');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => api('/staff', { method: 'POST', json: { email, roleKey, reason } }),
    meta: { success: 'Staff member added' },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setEmail('');
      setReason('');
      setOpen(false);
    },
    onError: (e) => setError(e.message),
  });

  return (
    <>
      <Button className="h-9 px-3 text-[14px]" onClick={() => setOpen(true)}>
        Add staff
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add staff member" width="max-w-[520px]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            add.mutate();
          }}
        >
          <Field label="Email" htmlFor="add-email" helper="Their Sinc account email. Admin access is given automatically; they set up two-factor on first sign-in.">
            <input id="add-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@sinc.today" />
          </Field>
          <Field label="Role" htmlFor="add-role">
            <select id="add-role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputClass}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason (audit log)" htmlFor="add-reason">
            <input id="add-reason" required value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="e.g. Joined support" />
          </Field>
          {error && <p className="text-[12px] text-ember-ink">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={add.isPending} disabled={!email || reason.trim().length < 3}>
              Add staff member
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
