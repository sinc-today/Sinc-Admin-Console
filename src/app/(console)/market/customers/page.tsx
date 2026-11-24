import { redirect } from 'next/navigation';

/** The partner customer lookup was replaced by the Sign-ups list on each event page. */
export default async function MarketCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const partnerId = typeof sp.partnerId === 'string' ? `?partnerId=${encodeURIComponent(sp.partnerId)}` : '';
  redirect(`/market/events${partnerId}`);
}
