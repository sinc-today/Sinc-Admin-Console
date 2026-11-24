/**
 * Plain-language definitions for terms a new staff member may not know.
 * Table headers, KPI labels and facts whose label matches a key get an "i" tooltip automatically.
 * Keep each under 25 words.
 */
export const GLOSSARY: Record<string, string> = {
  GMV: 'Gross merchandise value: everything buyers paid for tickets and products, before fees and commission.',
  'Commission revenue': "Sinc's commission on sales. For a 10,000 ticket at 8%, that is 800.",
  Commission: "Sinc's cut of the ticket price, set by the organizer's plan. 8% of 10,000 is 800.",
  'Take rate': 'Commission as a share of GMV.',
  'Aggregator fees': 'What the payment provider (MTN, Airtel, pawaPay…) charges Sinc to collect the money.',
  'Aggregator fee': 'What the payment provider charges Sinc to collect the money.',
  Fee: 'What the payment provider charges Sinc to collect this payment.',
  Royalty: "Sinc's royalty from a partner's market, as a % of the ticket price. Comes out of the shared commission.",
  'Sinc royalty': "Sinc's royalty from a partner's market, as a % of the ticket price.",
  Blocker: 'A third party (e.g. a federation levy) paid from the commission. Sinc funds up to its royalty; the operator funds the rest.',
  'Sinc keeps': 'What stays with Sinc after the operator and any blocker are paid. Never negative.',
  'Operator share': "The licence partner's cut: commission minus fee, Sinc's royalty and the operator's part of any blocker.",
  Operator: "The licence partner's cut of this sale.",
  'Of ticket price': "Operator share as a % of ticket sales. Differs by event because commissions and fees differ.",
  Credit: "Whether the operator's share has been paid into their Sinc wallet.",
  'Not credited yet': 'Shares earned but not yet in the wallet: being paid now, waiting for an account, or failed.',
  'Credited to their account': 'Shares already paid into the operator’s Sinc wallet.',
  p95: '95% of requests were faster than this.',
  'p50 / p95': 'Median and 95th-percentile response time.',
  '5xx': 'Share of requests that failed with a server error.',
  '5xx errors': 'Share of requests that failed with a server error.',
  '4xx': 'Share of requests refused as invalid (bad input, not allowed, not found).',
  'Requests/min': 'Requests per minute the service handled in this window.',
  Depth: 'Messages waiting in the queue.',
  Unacked: 'Messages delivered to a worker but not yet confirmed.',
  'Payment success rate': 'Successful payments ÷ (successful + failed). Pending ones are left out.',
  Success: 'Successful payments ÷ (successful + failed).',
  'Sell-through': 'Tickets issued ÷ capacity.',
  DAU: 'People active on a given day.',
  'Avg. daily active users': 'Average number of people active each day in the period.',
  Retention: 'Share of a signup month still active in later months.',
  'Access country': 'Country from GPS shared in the last 7 days, else the network. IPs are never stored.',
  KYC: 'Identity check of the organizer’s owner, needed before they can withdraw.',
  Held: 'Share earned but waiting: the partner has no Sinc account set yet.',
  Crediting: 'Being paid into the wallet now.',
};

export const tipFor = (label: string | undefined | null) => (label ? GLOSSARY[label] : undefined);
