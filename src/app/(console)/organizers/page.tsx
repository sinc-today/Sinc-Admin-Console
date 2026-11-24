'use client';

import { Avatar } from '@/components/Avatar';
import { parseAsString, useQueryStates } from 'nuqs';
import { NoAccess } from '@/components/PhasePlaceholder';
import { fmt } from '@/components/analytics-ui';
import { chipsFor, ExportButton, FilterBar, ListState, verificationBadge, RowLink, SavedViews, SearchForm, SelectField, Table, dayFmt, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { PagerBar, useCursorPager } from '@/components/pager';
import { Button, Panel } from '@/components/ui';
import { useScopeParams } from '@/lib/analytics';
import { useCan } from '../me-context';
import { useInMarket } from '@/lib/market';

interface OrgRow {
  id: number;
  name: string;
  username: string | null;
  logo?: string | null;
  owner: { id: number; name: string | null; imageUrl?: string | null } | null;
  verification: string | null;
  kycApproved: boolean;
  isActive: boolean;
  country: string | null;
  createdAt: string;
  events: number;
  upcoming: number;
  gmv: number;
  payments: number;
}

export default function OrganizersPage() {
  const can = useCan('organizers.read');
  const inMarket = useInMarket();
  const canExport = useCan('analytics.read') && !inMarket;
  const { params: scope, currency } = useScopeParams();
  const [f, setF] = useQueryStates({ q: parseAsString, verification: parseAsString, kyc: parseAsString, orgCountry: parseAsString });
  const params = new URLSearchParams(scope);
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
  const q = useCursorPager<OrgRow>('/organizers', params, { enabled: can });
  if (!can) return <NoAccess />;
  const items = q.items;
  const exportParams = new URLSearchParams(params);
  exportParams.delete('limit');
  const defs = [
    { key: 'verification', label: 'Verification', options: [{ value: 'APPROVED', label: 'Approved' }, { value: 'PENDING', label: 'Pending' }, { value: 'DECLINED', label: 'Declined' }] },
    { key: 'kyc', label: 'KYC', options: [{ value: 'true', label: 'Approved' }, { value: 'false', label: 'Not approved' }] },
    { key: 'orgCountry', label: 'Registered in', options: [{ value: 'RWA', label: 'Rwanda' }, { value: 'UGA', label: 'Uganda' }] },
  ];
  const fv = f as Record<string, string | null>;
  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        search={<SearchForm id="o-q" label="Search organizers" placeholder="Id, name, handle or owner" initial={f.q ?? ''} onSearch={(v) => setF({ q: v })} />}
        filters={defs.map((d) => (
          <SelectField key={d.key} id={`o-${d.key}`} label={d.label} value={fv[d.key]} onChange={(v) => setF({ [d.key]: v })} options={d.options} />
        ))}
        active={chipsFor(defs, fv, (k) => setF({ [k]: null }))}
        onClearAll={() => setF({ verification: null, kyc: null, orgCountry: null })}
        actions={
          <>
            {!inMarket && <SavedViews page="organizers" />}
            {canExport && <ExportButton path="/exports/organizers.csv" params={exportParams} />}
          </>
        }
      />
      <Panel title="Organizers" freshness="Newest first" info={`GMV is in ${currency} for the dates at the top.`} busy={q.isFetching && !!q.isPlaceholderData}>
        <ListState q={q} count={items.length} emptyTitle="No organizers match" emptyBody="Clear a filter or try another name.">
          <Table sticky head={['Id', 'Organizer', 'Owner', 'Verification', 'KYC', 'Country', 'Events', { label: `GMV (${currency})`, align: 'right' }, 'Joined', '']} minWidth={1040}>
            {items.map((o) => (
              <tr key={o.id} className="h-11 border-b border-line hover:bg-fog">
                <td className={`num ${tdFirst}`}>
                  <RowLink href={`/organizers/${o.id}`}>{o.id}</RowLink>
                </td>
                <td className={`${td} max-w-[260px] text-ink`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar src={o.logo} name={o.name} size={28} square />
                    <span className="truncate">{o.name}</span>
                    {o.username && <span className="hidden shrink-0 text-[12px] text-ink-muted 2xl:inline">@{o.username}</span>}
                  </span>
                </td>
                <td className={`${td} max-w-[200px]`}>
                  {o.owner ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar src={o.owner.imageUrl} name={o.owner.name ?? `#${o.owner.id}`} size={22} />
                      <span className="truncate"><RowLink href={`/users/${o.owner.id}`}>{o.owner.name ?? `#${o.owner.id}`}</RowLink></span>
                    </span>
                  ) : (
                    'None'
                  )}
                </td>
                <td className={td}>{verificationBadge(o.verification)}</td>
                <td className={`${td} text-ink-secondary`}>{o.kycApproved ? 'Approved' : 'No'}</td>
                <td className={`${td} text-ink-secondary`}>{o.country === 'UGA' ? 'Uganda' : o.country === 'RWA' ? 'Rwanda' : 'Unknown'}</td>
                <td className={`num ${td} text-ink-secondary`}>
                  {o.events}
                  {o.upcoming > 0 && <span className="ml-1 text-[12px] text-ink-muted">({o.upcoming} upcoming)</span>}
                </td>
                <td className={`num ${td} text-right text-ink`}>{o.gmv ? fmt('money', o.gmv, currency).replace(/^(RWF|UGX)\s/, '') : '0'}</td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{dayFmt(o.createdAt)}</td>
                <OpenCell href={`/organizers/${o.id}`} name={o.name} />
              </tr>
            ))}
          </Table>
        </ListState>
        <PagerBar pager={q} noun="organizers" />
      </Panel>
    </div>
  );
}
