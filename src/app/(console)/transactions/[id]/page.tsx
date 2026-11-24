'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLink } from '@/components/AppLink';
import { useParams } from 'next/navigation';
import { NoAccess } from '@/components/PhasePlaceholder';
import { TxStatus } from '@/components/TxStatus';
import { fmt, humanize } from '@/components/analytics-ui';
import { ErrorState, FeaturePanel, Panel, Skeleton, Tag } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useCan } from '../../me-context';

interface Detail {
  transaction: {
    id: number;
    createdAt: string;
    updatedAt: string;
    amount: number;
    originalAmount: number | null;
    currency: string;
    status: string;
    transactionType: string;
    paymentGateway: string | null;
    correspondent: string | null;
    flow: string | null;
    country: string;
    payerId: number | null;
    organizerProfileId: number | null;
    organizer: string | null;
    errorMessage: string | null;
    webhookStatus: string | null;
    txRef: string | null;
    providerIds: { flutterwave: string | null; pawapay: string | null };
  };
  sincups: { id: number; eventId: number; eventName: string; quantity: number | null; paidAmount: number | null; transactionMethod: string | null; createdAt: string }[];
  tickets: { id: number; ticketName: string | null; eventId: number | null; scanned: boolean; dateScanned: string | null; paidAmount: number | null }[];
  raw?: unknown;
  rawHidden: boolean;
}

export default function TransactionPage() {
  const can = useCan('money.read');
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['transaction', id], queryFn: () => api<Detail>(`/transactions/${id}`), enabled: can });
  if (!can) return <NoAccess />;
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <ErrorState message={(q.error as Error).message} requestId={(q.error as ApiError).requestId} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const t = d.transaction;
  const secs = Math.round((new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 1000);

  return (
    <div className="flex flex-col gap-5">
      <AppLink href="/transactions" className="text-[13px] text-ink-secondary hover:text-ink">
        ← All transactions
      </AppLink>
      <FeaturePanel tone="canvas">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[12px] font-medium text-ink-muted">
              Transaction {t.id} · {humanize(t.transactionType)}
            </p>
            <p className="display num mt-2 text-[40px] leading-[1.2] tracking-[-0.8px] text-ink">{fmt('money', t.amount, t.currency)}</p>
            {t.originalAmount !== null && t.originalAmount !== t.amount && (
              <p className="num mt-1 text-[13px] text-ink-secondary">Original amount {fmt('money', t.originalAmount, t.currency)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TxStatus status={t.status} />
            <Tag>{t.flow === 'OUTGOING' ? 'Money out' : 'Money in'}</Tag>
            <Tag>{t.country}</Tag>
          </div>
        </div>
        {t.errorMessage && <p className="mt-4 text-[14px] text-ember-ink">{t.errorMessage}</p>}
      </FeaturePanel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Details">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-2">
            <Item label="Created">{formatDateTime(t.createdAt)}</Item>
            <Item label="Last updated">
              {formatDateTime(t.updatedAt)} <span className="text-ink-muted">({secs < 120 ? `${secs} s` : `${Math.round(secs / 60)} min`} later)</span>
            </Item>
            <Item label="Provider">{humanize(t.paymentGateway)}</Item>
            <Item label="Network">{humanize(t.correspondent)}</Item>
            <Item label="Organizer">{t.organizer ?? 'None recorded'}</Item>
            <Item label="Payer">{t.payerId ? `User ${t.payerId}` : 'None recorded'}</Item>
            <Item label="Reference">{t.txRef ?? 'None'}</Item>
            <Item label="Callback status">{t.webhookStatus ?? 'None recorded'}</Item>
            {t.providerIds.flutterwave && <Item label="Flutterwave id">{t.providerIds.flutterwave}</Item>}
            {t.providerIds.pawapay && <Item label="pawaPay id">{t.providerIds.pawapay}</Item>}
          </dl>
        </Panel>
        <Panel title="Tickets and sign-ups">
          {d.sincups.length === 0 && d.tickets.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No tickets or event sign-ups are linked to this transaction.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line text-[13px]">
              {d.sincups.map((s) => (
                <li key={`s${s.id}`} className="py-3">
                  <p className="text-ink">{s.eventName ?? `Event ${s.eventId}`}</p>
                  <p className="text-[12px] text-ink-muted">
                    Sign-up {s.id} · {humanize(s.transactionMethod)} · {s.quantity ?? 1} ticket(s)
                  </p>
                </li>
              ))}
              {d.tickets.map((tk) => (
                <li key={`t${tk.id}`} className="flex items-center justify-between py-3">
                  <span className="text-ink">
                    {tk.ticketName ?? 'Ticket'} <span className="text-ink-muted">#{tk.id}</span>
                  </span>
                  <span className="text-[12px] text-ink-secondary">{tk.scanned ? `Scanned ${tk.dateScanned ? formatDateTime(tk.dateScanned) : ''}` : 'Not scanned'}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Provider payload">
        {d.rawHidden ? (
          <p className="text-[13px] text-ink-muted">Your role can&apos;t see raw provider data. Finance and engineering can.</p>
        ) : d.raw == null ? (
          <p className="text-[13px] text-ink-muted">No payload stored for this transaction.</p>
        ) : (
          <pre className="max-h-[420px] overflow-auto bg-fog p-4 text-[12px] leading-relaxed text-ink">{JSON.stringify(d.raw, null, 2)}</pre>
        )}
      </Panel>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-ink-muted">{label}</dt>
      <dd className="num mt-1 break-words text-ink">{children}</dd>
    </div>
  );
}
