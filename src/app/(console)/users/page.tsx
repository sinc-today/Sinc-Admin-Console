'use client';

import { Avatar } from '@/components/Avatar';
import { parseAsInteger, parseAsString, useQueryState, useQueryStates } from 'nuqs';
import { NoAccess } from '@/components/PhasePlaceholder';
import { chipsFor, CountryCode, FilterBar, ListState, RowLink, SavedViews, SearchForm, SelectField, Table, dayFmt, td, tdFirst, tdLast, OpenCell } from '@/components/directory-ui';
import { PagerBar, useCursorPager } from '@/components/pager';
import { Panel, StatusBadge } from '@/components/ui';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { formatRelative } from '@/lib/format';
import { useCan } from '../me-context';

interface UserRow {
  id: number;
  username: string;
  name: string | null;
  imageUrl?: string | null;
  email: string | null;
  registrationMethod: string | null;
  accountType: string | null;
  isBlocked: boolean;
  isVerified: boolean;
  createdAt: string;
  accessCountry: string | null;
  accessCountryName: string | null;
  phoneCountry?: string | null;
  lastActiveDay: string | null;
  lastSeenAt: string | null;
  lastPlatform: string | null;
}

export default function UsersPage() {
  const can = useCan('users.read');
  const [f, setF] = useQueryStates({ q: parseAsString, method: parseAsString, accountType: parseAsString, blocked: parseAsString, country: parseAsString, countryBy: parseAsString, active: parseAsString });
  const [, openUser] = useQueryState('user', parseAsInteger);
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
  const q = useCursorPager<UserRow>('/users', params, { enabled: can });
  if (!can) return <NoAccess />;
  const items = q.items;
  const defs = [
    {
      key: 'active',
      label: 'Activity',
      options: [
        { value: 'now', label: 'Active now (5 min)' },
        { value: 'today', label: 'Active today' },
        { value: '7d', label: 'Active in 7 days' },
        { value: '30d', label: 'Active in 30 days' },
        { value: 'inactive30', label: 'Inactive 30+ days' },
      ],
    },
    { key: 'country', label: 'Country', options: COUNTRY_OPTIONS },
    {
      key: 'countryBy',
      label: 'Country from',
      options: [
        { value: 'location', label: 'Where they use the app' },
        { value: 'phone', label: 'Phone number code' },
      ],
    },
    { key: 'method', label: 'Sign-in', options: [{ value: 'MANUAL', label: 'Email and password' }, { value: 'GOOGLE', label: 'Google' }, { value: 'APPLE', label: 'Apple' }] },
    { key: 'accountType', label: 'Account type', options: [{ value: 'personal', label: 'Personal' }, { value: 'business', label: 'Business' }] },
    { key: 'blocked', label: 'Status', options: [{ value: 'false', label: 'Active' }, { value: 'true', label: 'Blocked' }] },
  ];
  const fv = f as Record<string, string | null>;
  // A column that says "Unknown" on every row of this page tells nobody anything.
  const showCountry = items.some((u) => (u.accessCountry && u.accessCountry !== 'XX') || u.phoneCountry);
  const head = ['Id', 'User', 'Email', 'Sign-in', ...(showCountry ? ['Country'] : []), 'Joined', 'Last seen', 'Status', ''];
  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        search={<SearchForm id="u-q" label="Search users" placeholder="Id, username, name or email" helper="Exact id, or part of a username, name or email." initial={f.q ?? ''} onSearch={(v) => setF({ q: v })} />}
        filters={defs.map((d) => (
          <SelectField key={d.key} id={`u-${d.key}`} label={d.label} value={fv[d.key]} onChange={(v) => setF({ [d.key]: v })} options={d.options} />
        ))}
        active={chipsFor(defs, fv, (k) => setF({ [k]: null }))}
        onClearAll={() => setF({ active: null, country: null, countryBy: null, method: null, accountType: null, blocked: null })}
        actions={<SavedViews page="users" />}
      />
      <Panel title="Users" freshness="Newest first" info="Select a name for quick details; the id opens the full page." busy={q.isFetching && !!q.isPlaceholderData}>
        <ListState q={q} count={items.length} emptyTitle="No users match" emptyBody="Clear a filter or try another name.">
          <Table sticky head={head}>
            {items.map((u) => (
              <tr key={u.id} className="h-11 border-b border-line hover:bg-fog">
                <td className={`num ${tdFirst}`}>
                  <RowLink href={`/users/${u.id}`}>{u.id}</RowLink>
                </td>
                <td className={`${td} max-w-[260px]`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar src={u.imageUrl} name={u.name || u.username} size={28} />
                    <button type="button" onClick={() => openUser(u.id)} className="min-w-0 cursor-pointer truncate text-left text-ink hover:underline hover:decoration-ember hover:underline-offset-4" aria-label={`Open details for ${u.name || u.username}`}>
                      {u.name || u.username}
                    </button>
                    {u.name && <span className="hidden shrink-0 text-[12px] text-ink-muted 2xl:inline">@{u.username}</span>}
                  </span>
                </td>
                <td className={`${td} text-ink-secondary`}>{u.email ?? 'None'}</td>
                <td className={`${td} text-ink-secondary`}>{u.registrationMethod === 'MANUAL' ? 'Email' : u.registrationMethod ? u.registrationMethod.charAt(0) + u.registrationMethod.slice(1).toLowerCase() : 'Unknown'}</td>
                {showCountry && (
                  <td className={td}>
                    {u.accessCountry && u.accessCountry !== 'XX' ? (
                      <CountryCode code={u.accessCountry} name={u.accessCountryName} />
                    ) : u.phoneCountry ? (
                      <span className="inline-flex items-baseline gap-1.5" title="From the country code of their phone number">
                        <CountryCode code={u.phoneCountry} name={COUNTRY_OPTIONS.find((c) => c.value === u.phoneCountry)?.label ?? null} />
                        <span className="text-[11px] text-ink-muted">phone</span>
                      </span>
                    ) : (
                      <CountryCode code={null} />
                    )}
                  </td>
                )}
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>{dayFmt(u.createdAt)}</td>
                <td className={`num ${td} whitespace-nowrap text-ink-secondary`}>
                  {u.lastSeenAt ? (
                    <>
                      {Date.now() - new Date(u.lastSeenAt).getTime() < 5 * 60_000 && <span aria-hidden className="mr-1.5 inline-block size-2 rounded-pill bg-ember" />}
                      {formatRelative(u.lastSeenAt)}
                      {u.lastPlatform && u.lastPlatform !== 'other' && <span className="ml-1.5 text-[12px] text-ink-muted">{u.lastPlatform === 'ios' ? 'iOS' : u.lastPlatform === 'android' ? 'Android' : 'Web'}</span>}
                    </>
                  ) : u.lastActiveDay ? (
                    dayFmt(`${u.lastActiveDay}T12:00:00Z`)
                  ) : (
                    'Not seen'
                  )}
                </td>
                <td className={td}>{u.isBlocked ? <StatusBadge status="critical">Blocked</StatusBadge> : u.isVerified ? <StatusBadge status="ok">Verified</StatusBadge> : <StatusBadge status="info">Active</StatusBadge>}</td>
                <OpenCell href={`/users/${u.id}`} name={u.name || u.username} />
              </tr>
            ))}
          </Table>
        </ListState>
        <PagerBar pager={q} noun="users" />
      </Panel>
    </div>
  );
}
