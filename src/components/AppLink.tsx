'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { isMarketPath, marketHref } from '@/lib/market';

/** A Link that follows market mode: organizer/event links stay inside /market, Sinc-only pages become text. */
export function AppLink({ href, className, children, onClick, rowLink }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void; /** The row's main link: clicking the table row follows it. */ rowLink?: boolean }) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  const target = isMarketPath(pathname) ? marketHref(href, search) : href;
  if (!target) return <span className={className}>{children}</span>;
  return (
    <Link href={target} className={className} onClick={onClick} data-row-link={rowLink ? '' : undefined}>
      {children}
    </Link>
  );
}
