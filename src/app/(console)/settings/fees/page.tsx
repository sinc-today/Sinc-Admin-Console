'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NumberInput } from '@/components/NumberInput';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { humanize } from '@/components/analytics-ui';
import { Table, td, tdFirst, tdLast } from '@/components/directory-ui';
import { Button, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useCan } from '../../me-context';

type Structure =
  | { type: 'PERCENTAGE'; percentage: number }
  | { type: 'FIXED'; amount: number }
  | { type: 'COMPOSITE'; fixedAmount: number; percentage: number }
  | { type: 'TIERED'; tiers: { maxAmount: number | null; fixedAmount: number; percentage: number }[] };

interface FeeRow {
  id: number;
  provider: string;
  country: string;
  currency: string;
  flow: string;
  structure: Structure;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  inForce: boolean;
}
interface SmsRow {
  id: number;
  gateway: string;
  country: string;
  pricePerPart: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
  inForce: boolean;
}

const describe = (s: Structure, cur: string) => {
  switch (s.type) {
    case 'PERCENTAGE':
      return `${s.percentage}%`;
    case 'FIXED':
      return `${s.amount.toLocaleString('en')} ${cur}`;
    case 'COMPOSITE':
      return `${s.fixedAmount.toLocaleString('en')} ${cur} + ${s.percentage}%`;
    case 'TIERED':
      return s.tiers.map((t) => `${t.maxAmount === null ? 'above' : `≤ ${t.maxAmount.toLocaleString('en')}`}: ${t.fixedAmount ? `${t.fixedAmount.toLocaleString('en')} ${cur}` : ''}${t.fixedAmount && t.percentage ? ' + ' : ''}${t.percentage ? `${t.percentage}%` : ''}`).join(' · ');
  }
};
const gwLabel = humanize;
const OTHER = '__other__';

/** A code picker that also accepts a code not listed yet (e.g. a new aggregator before its first payment). */
function CodePicker({ id, label, codes, value, onChange, helper }: { id: string; label: string; codes: string[]; value: string; onChange: (v: string) => void; helper: string }) {
  const listed = codes.includes(value);
  const [other, setOther] = useState(!listed && value !== '');
  return (
    <>
      <Field label={label} htmlFor={id}>
        <select
          id={id}
          className={inputClass}
          value={other ? OTHER : value}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOther(true);
              onChange('');
            } else {
              setOther(false);
              onChange(e.target.value);
            }
          }}
        >
          {codes.map((c) => (
            <option key={c} value={c}>
              {humanize(c)}
            </option>
          ))}
          <option value={OTHER}>Another one…</option>
        </select>
      </Field>
      {other && (
        <Field label="Code" htmlFor={`${id}-code`} helper={helper}>
          <input
            id={`${id}-code`}
            required
            pattern="[A-Z][A-Z0-9_]{1,31}"
            className={inputClass}
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[\s-]+/g, '_').replace(/[^A-Z0-9_]/g, ''))}
            placeholder="e.g. NEW_PAY"
          />
        </Field>
      )}
    </>
  );
}
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const COUNTRY: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda', OTHER: 'Other' };
interface MissingFee {
  provider: string;
  country: string;
  currency: string;
  payments: number;
  lastAt: string;
}

export default function FeesPage() {
  const canRead = useCan('money.read');
  const canEdit = useCan('finance.config');
  const fees = useQuery({ queryKey: ['fees'], queryFn: () => api<{ items: FeeRow[]; providers: string[]; missing: MissingFee[] }>('/finance/fee-schedules'), enabled: canRead });
  const sms = useQuery({ queryKey: ['sms-rates'], queryFn: () => api<{ items: SmsRow[]; gateways: string[] }>('/finance/sms-rates'), enabled: canRead });
  const [showHistory, setShowHistory] = useState(false);
  if (!canRead) return <NoAccess />;
  const feeRows = (fees.data?.items ?? []).filter((r) => showHistory || r.inForce || r.effectiveFrom > new Date().toISOString().slice(0, 10));
  return (
    <div className="flex flex-col gap-5">
      {!!fees.data?.missing.length && (
        <section role="alert" aria-label="Providers without a fee" className="rounded-panel bg-canvas p-5 outline outline-1 outline-ember">
          <h2 className="text-[14px] font-medium text-ink">Providers with no fee set</h2>
          <p className="mt-1 text-[13px] text-ink-secondary">Partner shares come out too high until a rate is set{canEdit ? ' below' : ''}.</p>
          <ul className="mt-3 flex flex-col gap-1 text-[13px]">
            {fees.data.missing.map((m) => (
              <li key={`${m.provider}-${m.country}`} className="num">
                <span className="font-medium text-ink">{humanize(m.provider)}</span> · {COUNTRY[m.country] ?? m.country} · {m.payments.toLocaleString('en')} payments (90 days), last {new Date(m.lastAt).toLocaleDateString('en-GB')}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Panel
        title="Aggregator fees"
        freshness="Used for every sale's split from the day each rate takes effect. The events service picks up changes within 5 minutes."
        actions={
          <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} /> Show history
          </label>
        }
      >
        {fees.isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : fees.error ? (
          <ErrorState message={(fees.error as Error).message} requestId={(fees.error as ApiError).requestId} onRetry={() => fees.refetch()} />
        ) : (
          <Table minWidth={860} head={['Provider', 'Country', 'Flow', 'Rate', 'From', 'Status', 'Note']}>
            {feeRows.map((r) => (
              <tr key={r.id} className="h-11 border-b border-line">
                <td className={tdFirst}>{humanize(r.provider)}</td>
                <td className={`${td} text-ink-secondary`}>{COUNTRY[r.country]}</td>
                <td className={`${td} text-ink-secondary`}>{r.flow === 'COLLECTION' ? 'Collection' : 'Payout'}</td>
                <td className={`num ${td} max-w-[280px] whitespace-normal py-2`}>{describe(r.structure, r.currency)}</td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>
                  {r.effectiveFrom === '2020-01-01' ? 'Start' : r.effectiveFrom}
                  {r.effectiveTo && <span className="text-ink-muted"> to {r.effectiveTo}</span>}
                </td>
                <td className={td}>{r.inForce ? <StatusBadge status="ok">In force</StatusBadge> : r.effectiveTo ? <StatusBadge status="info">Ended</StatusBadge> : <StatusBadge status="pending">Scheduled</StatusBadge>}</td>
                <td className={`${tdLast} max-w-[240px] truncate text-[12px] text-ink-muted`} title={r.note ?? undefined}>
                  v{r.version}
                  {r.note ? ` · ${r.note}` : ''}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {canEdit && fees.data && <NewFeeForm providers={fees.data.providers} />}
      </Panel>

      <Panel title="SMS prices" freshness="Monitoring only: shown on Money → SMS, never deducted from anyone's share. A cost the provider reports wins over these prices.">
        {sms.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : sms.error ? (
          <ErrorState message={(sms.error as Error).message} requestId={(sms.error as ApiError).requestId} onRetry={() => sms.refetch()} />
        ) : (
          <Table minWidth={720} head={['Gateway', 'Destination', 'Price per part', 'From', 'Status', 'Note']}>
            {(sms.data?.items ?? []).map((r) => (
              <tr key={r.id} className="h-11 border-b border-line">
                <td className={tdFirst}>{gwLabel(r.gateway)}</td>
                <td className={`${td} text-ink-secondary`}>{COUNTRY[r.country]}</td>
                <td className={`num ${td}`}>
                  {r.pricePerPart.toLocaleString('en')} {r.currency}
                </td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{r.effectiveFrom === '2020-01-01' ? 'Start' : r.effectiveFrom}</td>
                <td className={td}>{r.inForce ? <StatusBadge status="ok">In force</StatusBadge> : r.effectiveTo ? <StatusBadge status="info">Ended</StatusBadge> : <StatusBadge status="pending">Scheduled</StatusBadge>}</td>
                <td className={`${tdLast} max-w-[240px] truncate text-[12px] text-ink-muted`} title={r.note ?? undefined}>
                  {r.note}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {canEdit && sms.data && <NewSmsForm gateways={sms.data.gateways} />}
      </Panel>
    </div>
  );
}

function NewFeeForm({ providers }: { providers: string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ provider: providers[0], country: 'RWA', flow: 'COLLECTION', kind: 'PERCENTAGE', percentage: '', fixed: '', effectiveFrom: tomorrow(), note: '', reason: '' });
  const save = useMutation({
    mutationFn: () => {
      const structure =
        f.kind === 'PERCENTAGE'
          ? { type: 'PERCENTAGE', percentage: Number(f.percentage) }
          : f.kind === 'FIXED'
            ? { type: 'FIXED', amount: Number(f.fixed) }
            : { type: 'COMPOSITE', fixedAmount: Number(f.fixed), percentage: Number(f.percentage) };
      return api('/finance/fee-schedules', {
        method: 'POST',
        json: { provider: f.provider, country: f.country, currency: f.country === 'UGA' ? 'UGX' : 'RWF', flow: f.flow, structure, effectiveFrom: f.effectiveFrom, note: f.note, reason: f.reason },
      });
    },
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['fees'] });
    },
  });
  if (!open)
    return (
      <div className="mt-4">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Set a new rate
        </Button>
      </div>
    );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="mt-5 grid grid-cols-1 gap-4 bg-fog p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <CodePicker
        id="nf-provider"
        label="Provider"
        codes={providers}
        value={f.provider}
        onChange={(v) => setF({ ...f, provider: v })}
        helper="Exactly as the payment service stores it (PAYMENT_PROVIDER), so sales match this fee."
      />
      <Field label="Country" htmlFor="nf-country">
        <select id="nf-country" className={inputClass} value={f.country} onChange={set('country')}>
          <option value="RWA">Rwanda (RWF)</option>
          <option value="UGA">Uganda (UGX)</option>
        </select>
      </Field>
      <Field label="Flow" htmlFor="nf-flow">
        <select id="nf-flow" className={inputClass} value={f.flow} onChange={set('flow')}>
          <option value="COLLECTION">Collection (buyer pays)</option>
          <option value="DISBURSEMENT">Payout</option>
        </select>
      </Field>
      <Field label="Rate type" htmlFor="nf-kind" helper="Tiered payout rates are kept as they are; ask engineering to change those.">
        <select id="nf-kind" className={inputClass} value={f.kind} onChange={set('kind')}>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed amount</option>
          <option value="COMPOSITE">Fixed + percentage</option>
        </select>
      </Field>
      {f.kind !== 'FIXED' && (
        <Field label="Percentage" htmlFor="nf-pct">
          <NumberInput id="nf-pct" step="0.01" min={0} max={100} required className={inputClass} value={f.percentage} onValue={(t) => setF({ ...f, percentage: t })} />
        </Field>
      )}
      {f.kind !== 'PERCENTAGE' && (
        <Field label={`Fixed amount (${f.country === 'UGA' ? 'UGX' : 'RWF'})`} htmlFor="nf-fixed">
          <NumberInput id="nf-fixed" step={1} min={0} required className={inputClass} value={f.fixed} onValue={(t) => setF({ ...f, fixed: t })} />
        </Field>
      )}
      <Field label="Takes effect on" htmlFor="nf-from" helper="Kigali date. Past sales keep the rate they used.">
        <input id="nf-from" type="date" required className={inputClass} value={f.effectiveFrom} onChange={set('effectiveFrom')} />
      </Field>
      <Field label="Note" htmlFor="nf-note">
        <input id="nf-note" className={inputClass} value={f.note} onChange={set('note')} placeholder="e.g. Contract ref" />
      </Field>
      <div className="md:col-span-4">
        <Field label="Reason (recorded in the audit log)" htmlFor="nf-reason">
          <input id="nf-reason" required minLength={5} className={inputClass} value={f.reason} onChange={set('reason')} />
        </Field>
      </div>
      {save.error && <p className="text-[12px] text-ember-ink md:col-span-4">{(save.error as Error).message}</p>}
      <div className="flex gap-2 md:col-span-4">
        <Button type="submit" loading={save.isPending}>
          Save new rate
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function NewSmsForm({ gateways }: { gateways: string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ gateway: gateways[0], country: 'RWA', pricePerPart: '', effectiveFrom: tomorrow(), note: '', reason: '' });
  const save = useMutation({
    mutationFn: () =>
      api('/finance/sms-rates', {
        method: 'POST',
        json: { gateway: f.gateway, country: f.country, pricePerPart: Number(f.pricePerPart), currency: f.country === 'UGA' ? 'UGX' : 'RWF', effectiveFrom: f.effectiveFrom, note: f.note, reason: f.reason },
      }),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['sms-rates'] });
    },
  });
  if (!open)
    return (
      <div className="mt-4">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Set an SMS price
        </Button>
      </div>
    );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="mt-5 grid grid-cols-1 gap-4 bg-fog p-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <CodePicker
        id="ns-gw"
        label="Gateway"
        codes={gateways}
        value={f.gateway}
        onChange={(v) => setF({ ...f, gateway: v })}
        helper="Exactly as the events service stores it (smsGateway)."
      />
      <Field label="Destination" htmlFor="ns-country">
        <select id="ns-country" className={inputClass} value={f.country} onChange={set('country')}>
          <option value="RWA">Rwanda (RWF)</option>
          <option value="UGA">Uganda (UGX)</option>
        </select>
      </Field>
      <Field label="Price per part" htmlFor="ns-price">
        <NumberInput id="ns-price" step="0.01" min={0} required className={inputClass} value={f.pricePerPart} onValue={(t) => setF({ ...f, pricePerPart: t })} />
      </Field>
      <Field label="Takes effect on" htmlFor="ns-from">
        <input id="ns-from" type="date" required className={inputClass} value={f.effectiveFrom} onChange={set('effectiveFrom')} />
      </Field>
      <div className="md:col-span-4">
        <Field label="Reason (recorded in the audit log)" htmlFor="ns-reason">
          <input id="ns-reason" required minLength={5} className={inputClass} value={f.reason} onChange={set('reason')} />
        </Field>
      </div>
      {save.error && <p className="text-[12px] text-ember-ink md:col-span-4">{(save.error as Error).message}</p>}
      <div className="flex gap-2 md:col-span-4">
        <Button type="submit" loading={save.isPending}>
          Save price
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
