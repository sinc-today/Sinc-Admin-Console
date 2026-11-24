'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { RowLink, Table, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { Button, EmptyState, ErrorState, Field, inputClass, Panel, Skeleton, StatusBadge } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { api, ApiError } from '@/lib/api';
import { ListSearch, PagerBar, useSearchPager } from '@/components/pager';
import { useCan } from '../me-context';
import { Modal } from '@/components/Modal';
import { OrganizerPicker } from '@/components/OrganizerPicker';
import { Account, AccessResult, COUNTRY_NAME, Credits, SplitPreview, Terms, TermsFields, Totals, accessMessage, accountLabel, emptyTerms, termsLine, termsPayload } from './shared';

interface Row {
  id: number;
  name: string;
  countries: string[];
  status: 'active' | 'suspended' | 'removed';
  account: Account | null;
  terms: Terms | null;
  nextTerms: Terms | null;
  periods: Totals[];
  operatorCredits: Credits;
  blockerCredits: Credits;
}

export default function PartnersPage() {
  const can = useCan('partners.read');
  const canManage = useCan('partners.manage');
  const { params, key } = useScopeParams();
  const [showRemoved, setShowRemoved] = useState(false);
  const qs = new URLSearchParams({ from: params.get('from')!, to: params.get('to')!, ...(showRemoved ? { removed: '1' } : {}) });
  const q = useQuery({ queryKey: ['partners', key, showRemoved], queryFn: () => api<{ items: Row[]; from: string; to: string }>(`/partners?${qs}`), enabled: can, placeholderData: (p) => p });
  const { pager, q: search, setQ: setSearch } = useSearchPager(q.data?.items ?? [], (p) => `${p.name} ${p.countries.join(' ')} ${p.countries.map((x) => COUNTRY_NAME[x] ?? x).join(' ')}`, 25);
  if (!can) return <NoAccess />;
  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Licence partners"
        freshness={
          q.data
            ? `One partner per country. Shares of sales in ${new Date(`${q.data.from}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' })} to ${new Date(`${q.data.to}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC' })}. Each share is credited to the partner's Sinc account within a few minutes of the sale.`
            : undefined
        }
      >
        {q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.error ? (
          <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />
        ) : !q.data?.items.length ? (
          <EmptyState title="No partners yet" body="Add a licence operator to share commission in their country." />
        ) : (
          <>
          <div className="mb-4">
            <ListSearch id="partners-q" value={search} onChange={setSearch} placeholder="Partner or country" label="Search partners" />
          </div>
          {!pager.items.length && <p className="py-2 text-[13px] text-ink-muted">No partner matches “{search}”.</p>}
          <Table minWidth={980} head={['Partner', 'Countries', 'Terms in force', { label: 'Sales', align: 'right' }, { label: 'Operator share', align: 'right' }, { label: 'Sinc keeps', align: 'right' }, 'Credits', '']}>
            {pager.items.map((p) => {
              const per = p.periods[0];
              const c = p.operatorCredits;
              return (
                <tr key={p.id} className="h-14 border-b border-line align-middle">
                  <td className={tdFirst}>
                    <RowLink href={`/partners/${p.id}`}>{p.name}</RowLink>
                    <div className="text-[12px] text-ink-muted">{accountLabel(p.account)}</div>
                  </td>
                  <td className={`${td} text-ink-secondary`}>{p.countries.map((x) => COUNTRY_NAME[x] ?? x).join(', ')}</td>
                  <td className={`${td} py-2 text-[13px]`}>
                    {p.status === 'removed' ? <StatusBadge status="info">Deleted</StatusBadge> : p.status === 'suspended' ? <StatusBadge status="warning">Suspended</StatusBadge> : p.terms ? termsLine(p.terms) : <span className="text-ink-muted">Starts {p.nextTerms?.effectiveFrom}</span>}
                    {p.nextTerms && p.terms && <div className="text-[12px] text-ink-muted">From {p.nextTerms.effectiveFrom}: {termsLine(p.nextTerms)}</div>}
                  </td>
                  <td className={`num ${td} text-right`}>{fmt('count', per?.sales ?? 0)}</td>
                  <td className={`num ${td} text-right`}>{per ? fmt('money', per.operatorShare, per.currency) : '–'}</td>
                  <td className={`num ${td} text-right`}>{per ? fmt('money', per.sincKeep, per.currency) : '–'}</td>
                  <td className={`${td} text-[12px]`}>
                    {c.failed.count > 0 ? (
                      <StatusBadge status="critical">{fmt('count', c.failed.count)} failed</StatusBadge>
                    ) : c.held.count > 0 ? (
                      <StatusBadge status="warning">{fmt('count', c.held.count)} waiting for an account</StatusBadge>
                    ) : c.inFlight.count > 0 ? (
                      <StatusBadge status="pending">{fmt('count', c.inFlight.count)} being credited</StatusBadge>
                    ) : (
                      <StatusBadge status="ok">Up to date</StatusBadge>
                    )}
                  </td>
                  <OpenCell href={`/partners/${p.id}`} name={p.name} />
                </tr>
              );
            })}
          </Table>
          </>
        )}
        <PagerBar pager={pager} noun="partners" />
        <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-secondary">
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show deleted partners (kept for their history)
        </label>
      </Panel>
      {canManage && <NewPartner />}
    </div>
  );
}

function NewPartner() {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', legalName: '', country: 'UGA', account: '', contactEmail: '', contactName: '', reason: '' });
  const [invite, setInvite] = useState(true);
  const [done, setDone] = useState<{ id: number; message: string | null; failed: boolean } | null>(null);
  const [terms, setTerms] = useState(emptyTerms());
  const save = useMutation({
    mutationFn: () =>
      api<{ id: number; access: AccessResult | null; accessError: string | null }>('/partners', {
        method: 'POST',
        json: {
          name: f.name,
          legalName: f.legalName || null,
          countries: [f.country],
          payoutOrganizerProfileId: f.account ? Number(f.account) : null,
          contactEmail: f.contactEmail || null,
          contactName: f.contactName || null,
          inviteContact: invite && !!f.contactEmail,
          terms: termsPayload(terms),
          reason: f.reason,
        },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['partners'] });
      // Without an invitation there is nothing to report: go straight to the partner.
      if (!r.access && !r.accessError) return router.push(`/partners/${r.id}`);
      setDone({
        id: r.id,
        failed: !!r.accessError || !r.access?.emailSent,
        message: r.access ? accessMessage(f.contactEmail, r.access) : `The partner was created, but dashboard access was not given: ${r.accessError}. Try again from the partner page.`,
      });
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const close = () => {
    setOpen(false);
    setDone(null);
    save.reset();
  };
  return (
    <>
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Add a partner
        </Button>
      </div>
      <Modal open={open} onClose={close} title="Add a partner" description="One partner per country. Sales from the start date are shared under these terms.">
      {done ? (
        <div className="flex flex-col gap-4">
          <p role="status" className={`text-[14px] ${done.failed ? 'text-ember-ink' : 'text-ink'}`}>
            Partner added. {done.message}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => router.push(`/partners/${done.id}`)}>Open the partner</Button>
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          </div>
        </div>
      ) : (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Name" htmlFor="np-name">
            <input id="np-name" required minLength={2} className={inputClass} value={f.name} onChange={set('name')} />
          </Field>
          <Field label="Legal name" htmlFor="np-legal">
            <input id="np-legal" className={inputClass} value={f.legalName} onChange={set('legalName')} />
          </Field>
          <Field label="Country" htmlFor="np-country">
            <select id="np-country" className={inputClass} value={f.country} onChange={set('country')}>
              <option value="UGA">Uganda</option>
              <option value="RWA">Rwanda</option>
            </select>
          </Field>
          <Field label="Sinc operator account" htmlFor="np-account" helper="Where their shares are paid. Shares wait until one is set.">
            <OrganizerPicker id="np-account" value={f.account} onChange={(v) => setF({ ...f, account: v })} />
          </Field>
          <Field label="Contact email" htmlFor="np-email">
            <input id="np-email" type="email" className={inputClass} value={f.contactEmail} onChange={set('contactEmail')} />
          </Field>
          <Field label="Contact name" htmlFor="np-contact-name">
            <input id="np-contact-name" className={inputClass} value={f.contactName} onChange={set('contactName')} />
          </Field>
          <label className="flex items-start gap-2 text-[13px] text-ink md:col-span-2">
            <input type="checkbox" className="mt-1" checked={invite} disabled={!f.contactEmail} onChange={(e) => setInvite(e.target.checked)} />
            <span>
              Give the contact access to their partner dashboard
              <span className="block text-[12px] text-ink-secondary">
                If the email has no Sinc account, one is created and they receive an email with a password they can change later. Otherwise they are emailed how to sign in with their existing account.
              </span>
            </span>
          </label>
        </div>
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <legend className="mb-3 text-[13px] font-medium text-ink">First terms</legend>
          <TermsFields id="np-terms" value={terms} onChange={setTerms} />
        </fieldset>
        <SplitPreview id="np-preview" country={f.country} terms={terms} />
        <Field label="Reason (recorded in the audit log)" htmlFor="np-reason">
          <input id="np-reason" required minLength={5} className={inputClass} value={f.reason} onChange={set('reason')} placeholder="e.g. Licence agreement signed 10 Nov 2026" />
        </Field>
        {save.error && <p className="text-[12px] text-ember-ink">{(save.error as Error).message}</p>}
        <div className="flex gap-2">
          <Button type="submit" loading={save.isPending}>
            Add partner
          </Button>
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
      )}
      </Modal>
    </>
  );
}
