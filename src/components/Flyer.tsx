'use client';

import { ImageBroken } from '@phosphor-icons/react';
import { useState } from 'react';
import clsx from 'clsx';

/** An event flyer. Loaded without a referrer; a missing or broken image shows a neutral placeholder. */
export function Flyer({ src, name, className, hideIfMissing = false }: { src: string | null | undefined; name: string; className?: string; hideIfMissing?: boolean }) {
  const [broken, setBroken] = useState(false);
  if ((!src || broken) && hideIfMissing) return null;
  if (!src || broken)
    return (
      <span className={clsx('inline-flex shrink-0 items-center justify-center bg-fog text-ink-muted', className)} aria-hidden>
        <ImageBroken size={16} />
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`Flyer for ${name}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={clsx('shrink-0 bg-fog object-cover', className)} />
  );
}
