'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { Button, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { PagerBar, useClientPager } from '@/components/pager';
import { formatRelative } from '@/lib/format';
import { useCan } from '../../me-context';

interface Flag {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPct: number;
  countries: string[];
  updatedAt: string;
}

const scopeText = (f: Pick<Flag, 'enabled' | 'rolloutPct' | 'countries'>) =>
  !f.enabled ? 'Off for everyone' : `${f.rolloutPct === 100 ? 'Everyone' : `${f.rolloutPct}% of signed-in users`}${f.countries.length ? ` in ${f.countries.map((c) => (c === 'UGA' ? 'Uganda' : 'Rwanda')).join(' and ')}` : ''}`;

export default function FlagsPage() {
  const can = useCan('flags.write');
  const q = useQuery({ queryKey: ['flags'], queryFn: () => api<{ items: Flag[] }>('/flags'), enabled: can });
  const [editing, setEditing] = useState<Flag | 'new' | null>(null);
  const pager = useClientPager(q.data?.items ?? [], 25);
  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Feature flags"
        freshness="Services read these from GET /internal/flags with their ingest token. The same users stay in a rollout as the percentage grows."
        actions={
          <Button variant="secondary" onClick={() => setEditing('new')}>
            New flag
          </Button>
        }
      >
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.error ? (
          <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <p className="py-2 text-[13px] text-ink-muted">No flags yet.</p>
        ) : (
          <ul className="flex flex-col">
            {pager.items.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-ink">{f.key}</p>
                  {f.description && <p className="text-[13px] text-ink-secondary">{f.description}</p>}
                  <p className="text-[12px] text-ink-muted">
                    {scopeText(f)} · changed {formatRelative(f.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={f.enabled ? 'ok' : 'info'}>{f.enabled ? 'On' : 'Off'}</StatusBadge>
                  <Button variant="quiet" onClick={() => setEditing(f)} aria-label={`Change ${f.key}`}>
                    Change
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <PagerBar pager={pager} noun="flags" />
      </Panel>
      {editing && <FlagForm flag={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
    </div>
  );
}

function FlagForm({ flag, onDone }: { flag: Flag | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ key: flag?.key ?? '', description: flag?.description ?? '', enabled: flag?.enabled ?? false, rolloutPct: flag?.rolloutPct ?? 0, countries: flag?.countries ?? [], reason: '' });
  const m = useMutation({
    mutationFn: () =>
      flag
        ? api(`/flags/${flag.key}`, { method: 'PATCH', json: { description: f.description, enabled: f.enabled, rolloutPct: f.rolloutPct, countries: f.countries, reason: f.reason } })
        : api('/flags', { method: 'POST', json: f }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flags'] });
      onDone();
    },
  });
  const toggleCountry = (c: string) => setF({ ...f, countries: f.countries.includes(c) ? f.countries.filter((x) => x !== c) : [...f.countries, c] });
  return (
    <Panel title={flag ? `Change ${flag.key}` : 'New flag'} freshness={`Result: ${scopeText(f)}.`}>
      <form
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {!flag && (
          <Field label="Key" htmlFor="fl-key" helper="Lower case, e.g. checkout.installments. Can't be changed later.">
            <input id="fl-key" required pattern="[a-z][a-z0-9_.\-]{1,63}" className={`${inputClass} font-mono`} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} />
          </Field>
        )}
        <Field label="What it controls" htmlFor="fl-desc">
          <input id="fl-desc" maxLength={300} className={inputClass} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> On
        </label>
        <Field label={`Rollout: ${f.rolloutPct}%`} htmlFor="fl-pct" helper="Below 100%, only signed-in users can be included.">
          <input id="fl-pct" type="range" min={0} max={100} step={5} value={f.rolloutPct} onChange={(e) => setF({ ...f, rolloutPct: Number(e.target.value) })} className="w-full" />
        </Field>
        <fieldset className="flex flex-wrap items-center gap-4 text-[14px]">
          <legend className="mb-1 text-[12px] font-medium text-ink-secondary">Countries (none ticked = everywhere)</legend>
          {[
            ['RWA', 'Rwanda'],
            ['UGA', 'Uganda'],
          ].map(([c, l]) => (
            <label key={c} className="flex items-center gap-2">
              <input type="checkbox" checked={f.countries.includes(c)} onChange={() => toggleCountry(c)} /> {l}
            </label>
          ))}
        </fieldset>
        <div className="md:col-span-2">
          <Field label="Reason (recorded in the audit log)" htmlFor="fl-reason">
            <input id="fl-reason" required minLength={5} className={inputClass} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </div>
        {m.error && <p className="text-[12px] text-ember-ink md:col-span-2">{(m.error as Error).message}</p>}
        <div className="flex gap-2 md:col-span-2">
          <Button type="submit" loading={m.isPending}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}
