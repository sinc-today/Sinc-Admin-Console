'use client';

import { OrganizerPicker } from '@/components/OrganizerPicker';
import { NumberInput } from '@/components/NumberInput';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fmt, humanize } from '@/components/analytics-ui';
import { Field, inputClass } from '@/components/ui';
import { api } from '@/lib/api';
import { useProviders } from '@/lib/providers';

export interface Account {
  id: number;
  name: string | null;
  username?: string | null;
  currency?: string | null;
}
export interface Terms {
  id: number;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  royaltyPct: number;
  blockerPct: number;
  blockerSincPct: number;
  blockerLabel: string | null;
  blockerPayoutOrganizerProfileId: number | null;
  blockerAccount?: Account | null;
  note: string | null;
  state: 'in_force' | 'scheduled' | 'ended';
}
export interface CreditBucket {
  count: number;
  amount: number;
}
export interface Credits {
  credited: CreditBucket;
  inFlight: CreditBucket;
  held: CreditBucket;
  failed: CreditBucket;
}
export interface Totals {
  currency: string;
  sales: number;
  gross: number;
  commission: number;
  aggregatorFee: number;
  royalty: number;
  blocker: number;
  operatorShare: number;
  sincKeep: number;
  shortfalls: number;
}

export const COUNTRY_NAME: Record<string, string> = { RWA: 'Rwanda', UGA: 'Uganda' };
export const pct = (v: number) => `${Number(v.toFixed(3))}%`;
export const accountLabel = (a: Account | null | undefined) => (!a ? 'Not assigned' : a.name ? `${a.name} (#${a.id})` : `#${a.id}`);
export const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());

/** One-line summary of terms, e.g. "Royalty 1.5% · blocker 1% (Sinc funds 50%)". */
export const termsLine = (t: Pick<Terms, 'royaltyPct' | 'blockerPct' | 'blockerSincPct' | 'blockerLabel'>) =>
  `Royalty ${pct(t.royaltyPct)}${
    t.blockerPct > 0
      ? ` · ${t.blockerLabel || 'blocker'} ${pct(t.blockerPct)} (${t.blockerSincPct >= 100 ? 'Sinc funds it' : t.blockerSincPct <= 0 ? 'operator funds it' : `Sinc funds ${pct(t.blockerSincPct)}`})`
      : ''
  }`;

/* ------------------------------------------------------------------ terms form fields */

export interface TermsDraft {
  effectiveFrom: string;
  royaltyPct: string;
  blockerPct: string;
  blockerSincPct: string;
  blockerLabel: string;
  blockerPayoutOrganizerProfileId: string;
  note: string;
}
export const emptyTerms = (from = kigaliToday()): TermsDraft => ({ effectiveFrom: from, royaltyPct: '1.5', blockerPct: '0', blockerSincPct: '0', blockerLabel: '', blockerPayoutOrganizerProfileId: '', note: '' });
export const termsPayload = (d: TermsDraft) => ({
  effectiveFrom: d.effectiveFrom,
  royaltyPct: Number(d.royaltyPct),
  blockerPct: Number(d.blockerPct || 0),
  blockerSincPct: Number(d.blockerSincPct || 0),
  blockerLabel: d.blockerLabel || null,
  blockerPayoutOrganizerProfileId: d.blockerPayoutOrganizerProfileId ? Number(d.blockerPayoutOrganizerProfileId) : null,
  note: d.note || null,
});

export function TermsFields({ id, value, onChange }: { id: string; value: TermsDraft; onChange: (v: TermsDraft) => void }) {
  const set = (k: keyof TermsDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const num = (k: keyof TermsDraft) => (t: string) => onChange({ ...value, [k]: t });
  const hasBlocker = Number(value.blockerPct) > 0;
  return (
    <>
      <Field label="Takes effect on" htmlFor={`${id}-from`} helper="Kigali date. Sales keep the terms of the day they happened.">
        <input id={`${id}-from`} type="date" required className={inputClass} value={value.effectiveFrom} onChange={set('effectiveFrom')} />
      </Field>
      <Field label="Sinc royalty (% of ticket price)" htmlFor={`${id}-royalty`} helper="0 during a grace period.">
        <NumberInput id={`${id}-royalty`} step="0.01" min={0} max={100} required className={inputClass} value={value.royaltyPct} onValue={num('royaltyPct')} />
      </Field>
      <Field label="Blocker (% of ticket price)" htmlFor={`${id}-blocker`} helper="Optional. 0 means no blocker.">
        <NumberInput id={`${id}-blocker`} step="0.01" min={0} max={100} className={inputClass} value={value.blockerPct} onValue={num('blockerPct')} />
      </Field>
      <Field label="Share of the blocker Sinc funds (%)" htmlFor={`${id}-bsinc`} helper="Capped at Sinc's royalty. The operator covers the rest.">
        <NumberInput id={`${id}-bsinc`} step={1} min={0} max={100} disabled={!hasBlocker} className={inputClass} value={value.blockerSincPct} onValue={num('blockerSincPct')} />
      </Field>
      {hasBlocker && (
        <>
          <Field label="Blocker name" htmlFor={`${id}-blabel`}>
            <input id={`${id}-blabel`} className={inputClass} value={value.blockerLabel} onChange={set('blockerLabel')} placeholder="e.g. Federation levy" />
          </Field>
          <Field label="Blocker's Sinc account" htmlFor={`${id}-bacc`} helper="Where blocker shares are paid. They wait until one is set.">
            <OrganizerPicker id={`${id}-bacc`} value={value.blockerPayoutOrganizerProfileId} onChange={(v) => onChange({ ...value, blockerPayoutOrganizerProfileId: v })} />
          </Field>
        </>
      )}
      <Field label="Note" htmlFor={`${id}-note`}>
        <input id={`${id}-note`} className={inputClass} value={value.note} onChange={set('note')} placeholder="e.g. Agreement clause 4.2" />
      </Field>
    </>
  );
}

/* ------------------------------------------------------------------ split calculator */

interface Preview {
  currency: string;
  gross: number;
  commission: number;
  aggregatorFee: number;
  feeVersion: number;
  organizerGets: number;
  available: number;
  royalty: number;
  blocker: number;
  blockerSincFunded: number;
  operatorShare: number;
  sincKeep: number;
  shortfall: boolean;
  sincCapped?: boolean;
}


/** Shows how one sale splits under given terms, with today's aggregator fee. */
export function SplitPreview({ id, country, terms }: { id: string; country: string; terms: Pick<TermsDraft, 'royaltyPct' | 'blockerPct' | 'blockerSincPct'> }) {
  const [gross, setGross] = useState('10000');
  const [commissionPct, setCommissionPct] = useState('8');
  // Providers with a collection fee in force for this country (from the console's fee schedules).
  const providers = useProviders();
  const gateways = (providers.data?.providers ?? []).filter((p) => p.priced.some((x) => x.country === country)).map((p) => p.code);
  const [picked, setGateway] = useState<string | null>(null);
  useEffect(() => setGateway(null), [country]);
  const gateway = picked && gateways.includes(picked) ? picked : gateways.includes('PAWA_PAY') ? 'PAWA_PAY' : gateways[0] ?? 'PAWA_PAY';
  const qs = new URLSearchParams({ gross, commissionPct, gateway, country, royaltyPct: terms.royaltyPct || '0', blockerPct: terms.blockerPct || '0', blockerSincPct: terms.blockerSincPct || '0' });
  const valid = Number(gross) > 0 && Number(commissionPct) >= 0 && gateways.length > 0;
  const q = useQuery({ queryKey: ['split-preview', qs.toString()], queryFn: () => api<Preview>(`/partners/preview?${qs}`), enabled: valid, placeholderData: (p) => p });
  const d = q.data;
  const cur = d?.currency ?? (country === 'UGA' ? 'UGX' : 'RWF');
  const rows: [string, number | undefined, string?][] = d
    ? [
        ['Organizer receives', d.organizerGets],
        [`${humanize(gateway)} fee`, -d.aggregatorFee],
        ['Sinc keeps', d.sincKeep],
        ...(d.blocker > 0 ? ([['Blocker', d.blocker]] as [string, number][]) : []),
        ['Operator share', d.operatorShare, d.shortfall ? 'Commission too low for an operator share' : d.sincCapped ? 'Covers the blocker above Sinc\'s royalty' : undefined],
      ]
    : [];
  return (
    <section aria-label="Split calculator" className="bg-fog p-4">
      <h3 className="text-[13px] font-medium text-ink">How one sale splits</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={`Ticket price (${cur})`} htmlFor={`${id}-gross`}>
          <NumberInput id={`${id}-gross`} min={1} step="any" className={inputClass} value={gross} onValue={(t) => setGross(t)} />
        </Field>
        <Field label="Organizer's commission (%)" htmlFor={`${id}-comm`}>
          <NumberInput id={`${id}-comm`} step="0.1" min={0} max={100} className={inputClass} value={commissionPct} onValue={(t) => setCommissionPct(t)} />
        </Field>
        <Field label="Paid with" htmlFor={`${id}-gw`}>
          <select id={`${id}-gw`} className={inputClass} value={gateway} onChange={(e) => setGateway(e.target.value)}>
            {gateways.map((g) => (
              <option key={g} value={g}>
                {humanize(g)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {q.error ? (
        <p className="mt-3 text-[12px] text-ember-ink">{(q.error as Error).message}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2" aria-live="polite">
          {rows.map(([label, v, hint]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-1">
              <dt className="text-ink-secondary" title={hint}>
                {label}
                {hint && <span className="ml-1 text-ember-ink">*</span>}
              </dt>
              <dd className="num text-ink">{v === undefined ? '…' : fmt('money', v, cur)}</dd>
            </div>
          ))}
        </dl>
      )}
      {d && (d.shortfall || d.sincCapped) && (
        <p className="mt-2 text-[12px] text-ember-ink">
          * {d.shortfall ? 'Commission too low: operator share is 0.' : 'Sinc funds the blocker up to its royalty. The operator pays the rest.'}
        </p>
      )}
    </section>
  );
}

/** What happened when someone was given dashboard access (account created, email sent or not). */
export interface AccessResult {
  accountCreated: boolean;
  emailSent: boolean;
  emailError: string | null;
}
export const accessMessage = (email: string, r: AccessResult) =>
  r.accountCreated
    ? r.emailSent
      ? `Created a Sinc account for ${email} and emailed them a password. They set up 2FA when they first sign in.`
      : `Created a Sinc account for ${email}, but the email with their password could not be sent${r.emailError ? ` (${r.emailError})` : ''}. Remove and add them again once email works, or ask them to use "Forgot password" in the Sinc app.`
    : r.emailSent
      ? `${email} already has a Sinc account. They now have access and were emailed how to sign in with their existing password.`
      : `${email} already has a Sinc account and now has access, but the notice email could not be sent. Tell them to sign in with their Sinc password.`;
