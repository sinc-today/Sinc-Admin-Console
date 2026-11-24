'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { Button, ErrorState, Field, inputClass, Panel, Skeleton, InfoTip } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

interface Plan {
  id: number;
  name: string;
  price: number;
  maxAttendance: number;
  highestPrice: number;
  nonFollowerReach: boolean;
  includesSincSupport: boolean;
  dynamicSaleCommission: boolean;
  commissionPercentage: number | null;
}
interface Catalog {
  contexts: { id: number; name: string; url: string | null; events: number }[];
  categories: { id: number; name: string; imageUrl: string | null; products: number | null }[];
  tags: { id: number; name: string }[];
  plans: Plan[];
  permissions: { id: number; name: string }[];
}

type Edit =
  | { kind: 'tag'; id?: number; name: string }
  | { kind: 'context' | 'category'; id: number; name: string }
  | { kind: 'plan'; plan: Partial<Plan> }
  | { kind: 'delete-tag' | 'delete-plan'; id: number; name: string };

export default function CatalogPage() {
  const can = useCan('catalog.manage');
  const q = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/catalog'), enabled: can });
  const [edit, setEdit] = useState<Edit | null>(null);
  if (!can) return <NoAccess />;
  if (q.isLoading) return <Skeleton className="h-[480px] w-full" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const editor = edit && <Editor edit={edit} onDone={() => setEdit(null)} />;
  const inPanel = (k: string) => edit && (edit.kind === k || edit.kind === `delete-${k}` || (k === 'context' && edit.kind === 'context') || (k === 'category' && edit.kind === 'category'));
  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-center gap-1 text-[13px] text-ink-secondary">
        Every change is audited.
        <InfoTip label="About catalog changes">Changes go through the events service with your reason. New categories need an image, so they are still added from the old admin tools.</InfoTip>
      </p>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Event categories" freshness={`${d.contexts.length} categories`}>
          <Table minWidth={360} head={['Category', { label: 'Events', align: 'right' }, '']}>
            {d.contexts.map((c) => (
              <tr key={c.id} className="h-10 border-b border-line">
                <td className={tdFirst}>{c.name}</td>
                <td className={`num ${td} text-right`}>{fmt('count', c.events)}</td>
                <td className={`${tdLast} text-right`}>
                  <Button variant="quiet" onClick={() => setEdit({ kind: 'context', id: c.id, name: c.name })} aria-label={`Rename ${c.name}`}>
                    Rename
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          {inPanel('context') && editor}
        </Panel>
        <Panel title="Product categories" freshness={`${d.categories.length} categories`}>
          {!d.categories.length ? (
            <p className="py-2 text-[13px] text-ink-muted">None yet.</p>
          ) : (
            <Table minWidth={360} head={['Category', { label: 'Products', align: 'right' }, '']}>
              {d.categories.map((c) => (
                <tr key={c.id} className="h-10 border-b border-line">
                  <td className={tdFirst}>{c.name}</td>
                  <td className={`num ${td} text-right`}>{fmt('count', c.products ?? 0)}</td>
                  <td className={`${tdLast} text-right`}>
                    <Button variant="quiet" onClick={() => setEdit({ kind: 'category', id: c.id, name: c.name })} aria-label={`Rename ${c.name}`}>
                      Rename
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {inPanel('category') && editor}
        </Panel>
      </div>

      <Panel
        title="Tags"
        freshness={`${d.tags.length} tags`}
        actions={
          <Button variant="secondary" onClick={() => setEdit({ kind: 'tag', name: '' })}>
            Add tag
          </Button>
        }
      >
        <ul className="flex flex-wrap gap-2">
          {d.tags.map((t) => (
            <li key={t.id} className="inline-flex items-center gap-1 rounded-tag bg-fog pl-3 text-[13px]">
              {t.name}
              <button type="button" className="h-7 px-2 text-ink-secondary hover:text-ink" onClick={() => setEdit({ kind: 'tag', id: t.id, name: t.name })} aria-label={`Rename ${t.name}`}>
                Edit
              </button>
              <button type="button" className="h-7 pr-3 text-ink-secondary hover:text-ember-ink" onClick={() => setEdit({ kind: 'delete-tag', id: t.id, name: t.name })} aria-label={`Delete ${t.name}`}>
                Delete
              </button>
            </li>
          ))}
          {!d.tags.length && <li className="text-[13px] text-ink-muted">No tags yet.</li>}
        </ul>
        {inPanel('tag') && editor}
      </Panel>

      <Panel
        title="Organizer plans"
        freshness="What each plan allows. Commission percentages are set per plan subscription in the events service."
        actions={
          <Button variant="secondary" onClick={() => setEdit({ kind: 'plan', plan: { name: '', price: 0, maxAttendance: 100, highestPrice: 10000, nonFollowerReach: false, includesSincSupport: false, dynamicSaleCommission: false } })}>
            Add plan
          </Button>
        }
      >
        <Table minWidth={760} head={['Plan', { label: 'Price', align: 'right' }, { label: 'Max attendance', align: 'right' }, { label: 'Highest ticket', align: 'right' }, 'Includes', '']}>
          {d.plans.map((p) => (
            <tr key={p.id} className="h-11 border-b border-line">
              <td className={tdFirst}>{p.name}</td>
              <td className={`num ${td} text-right`}>{fmt('count', p.price)}</td>
              <td className={`num ${td} text-right`}>{fmt('count', p.maxAttendance)}</td>
              <td className={`num ${td} text-right`}>{fmt('count', p.highestPrice)}</td>
              <td className={`${td} text-[12px] text-ink-secondary`}>
                {[p.nonFollowerReach && 'Reach beyond followers', p.includesSincSupport && 'Sinc support', p.dynamicSaleCommission && 'Custom commission'].filter(Boolean).join(', ') || 'Basics'}
              </td>
              <td className={`${tdLast} whitespace-nowrap text-right`}>
                <Button variant="quiet" onClick={() => setEdit({ kind: 'plan', plan: p })}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => setEdit({ kind: 'delete-plan', id: p.id, name: p.name })}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        {inPanel('plan') && editor}
      </Panel>

      <Panel title="Organizer team permissions" freshness="Permissions organizers can give their team members. Read only here.">
        <ul className="flex flex-wrap gap-2">
          {d.permissions.map((p) => (
            <li key={p.id} className="rounded-tag bg-fog px-3 py-1 text-[12px]">
              {p.name}
            </li>
          ))}
          {!d.permissions.length && <li className="text-[13px] text-ink-muted">None found.</li>}
        </ul>
      </Panel>
    </div>
  );
}

function Editor({ edit, onDone }: { edit: Edit; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('name' in edit ? edit.name : '');
  const [plan, setPlan] = useState<Partial<Plan>>(edit.kind === 'plan' ? edit.plan : {});
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => {
      switch (edit.kind) {
        case 'tag':
          return edit.id ? api(`/catalog/tags/${edit.id}`, { method: 'PATCH', json: { name, reason } }) : api('/catalog/tags', { method: 'POST', json: { name, reason } });
        case 'context':
          return api(`/catalog/contexts/${edit.id}`, { method: 'PATCH', json: { name, reason } });
        case 'category':
          return api(`/catalog/categories/${edit.id}`, { method: 'PATCH', json: { name, reason } });
        case 'delete-tag':
          return api(`/catalog/tags/${edit.id}`, { method: 'DELETE', json: { reason } });
        case 'delete-plan':
          return api(`/catalog/plans/${edit.id}`, { method: 'DELETE', json: { reason } });
        case 'plan': {
          const { id, commissionPercentage: _c, ...body } = plan;
          void _c;
          return id ? api(`/catalog/plans/${id}`, { method: 'PATCH', json: { ...body, reason } }) : api('/catalog/plans', { method: 'POST', json: { ...body, reason } });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog'] });
      onDone();
    },
  });
  const title =
    edit.kind === 'delete-tag' || edit.kind === 'delete-plan'
      ? `Delete ${edit.name}?`
      : edit.kind === 'plan'
        ? plan.id
          ? `Edit ${plan.name}`
          : 'New plan'
        : 'id' in edit && edit.id
          ? `Rename ${'name' in edit ? edit.name : ''}`
          : 'New tag';
  const num = (k: keyof Plan) => (e: React.ChangeEvent<HTMLInputElement>) => setPlan({ ...plan, [k]: Number(e.target.value) });
  const flag = (k: keyof Plan) => (e: React.ChangeEvent<HTMLInputElement>) => setPlan({ ...plan, [k]: e.target.checked });
  return (
    <form
      className="mt-4 flex flex-col gap-3 bg-fog p-4"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <h3 className="text-[14px] font-medium text-ink">{title}</h3>
      {(edit.kind === 'delete-tag' || edit.kind === 'delete-plan') && (
        <p className="text-[13px] text-ink-secondary">{edit.kind === 'delete-plan' ? 'Organizers on this plan keep their current subscription until it ends; check with engineering first.' : 'It is removed from every event that uses it.'}</p>
      )}
      {(edit.kind === 'tag' || edit.kind === 'context' || edit.kind === 'category') && (
        <Field label="Name" htmlFor="cat-name">
          <input id="cat-name" required minLength={2} maxLength={80} autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      {edit.kind === 'plan' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="pl-name">
            <input id="pl-name" required className={inputClass} value={plan.name ?? ''} onChange={(e) => setPlan({ ...plan, name: e.target.value })} />
          </Field>
          <Field label="Price" htmlFor="pl-price">
            <input id="pl-price" type="number" min="0" required className={inputClass} value={plan.price ?? 0} onChange={num('price')} />
          </Field>
          <Field label="Max attendance per event" htmlFor="pl-att">
            <input id="pl-att" type="number" min="1" required className={inputClass} value={plan.maxAttendance ?? 1} onChange={num('maxAttendance')} />
          </Field>
          <Field label="Highest ticket price" htmlFor="pl-hp">
            <input id="pl-hp" type="number" min="1" required className={inputClass} value={plan.highestPrice ?? 1} onChange={num('highestPrice')} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!plan.nonFollowerReach} onChange={flag('nonFollowerReach')} /> Reach beyond followers
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!plan.includesSincSupport} onChange={flag('includesSincSupport')} /> Includes Sinc support
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!plan.dynamicSaleCommission} onChange={flag('dynamicSaleCommission')} /> Can request a custom commission
          </label>
        </div>
      )}
      <Field label="Reason (recorded in the audit log)" htmlFor="cat-reason">
        <input id="cat-reason" required minLength={5} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {m.error && <p className="text-[12px] text-ember-ink">{(m.error as Error).message}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={m.isPending}>
          {edit.kind.startsWith('delete') ? 'Delete' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
