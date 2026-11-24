'use client';

import { notFound, usePathname } from 'next/navigation';
import { NoAccess, PhasePlaceholder } from '@/components/PhasePlaceholder';
import { findNavItem } from '@/lib/nav';
import { useMe } from '../me-context';

/** Catch-all for sections that arrive in later phases. Real pages override this route. */
export default function SectionPlaceholder() {
  const pathname = usePathname();
  const me = useMe();
  const item = findNavItem(pathname);
  if (!item || item.phase === 0) notFound();
  if (item.permission && !me.permissions.includes(item.permission)) return <NoAccess />;
  return <PhasePlaceholder item={item} />;
}
