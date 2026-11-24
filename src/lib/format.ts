/** Number, money and date formatting (prompt section 8.6). Intl only. */

export type Currency = 'RWF' | 'UGX';

export const formatMoney = (value: number, currency: Currency, opts: { compact?: boolean } = {}) =>
  new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: opts.compact ? 2 : 0,
    minimumFractionDigits: 0,
    notation: opts.compact ? 'compact' : 'standard',
  })
    .format(value)
    .replace(/ /g, ' ');

export const formatCount = (value: number, opts: { compact?: boolean } = {}) =>
  new Intl.NumberFormat('en-RW', { notation: opts.compact ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

export const formatPercent = (ratio: number, decimals?: number) => {
  const pct = ratio * 100;
  const d = decimals ?? (Math.abs(pct) < 10 ? 1 : 0);
  return `${pct.toFixed(d)}%`;
};

export const formatDateTime = (iso: string | Date, timeZone = 'Africa/Kigali') =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso)).replace(',', '');

export const formatRelative = (iso: string | Date, now = Date.now()) => {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
};

/** +250 78• ••• 252 style masking for phone numbers shown in lists. */
export const maskPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '•••';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)}• ••• ${digits.slice(-3)}`;
};
