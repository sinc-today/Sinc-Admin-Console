'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

const initialsOf = (name: string | null | undefined) =>
  (name ?? '')
    .replace(/^@/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

/** Soft background per name, so people without a picture are still easy to tell apart. */
const TONES = ['bg-ember-wash text-ember-ink', 'bg-brass-wash text-brass-ink', 'bg-fog text-ink-secondary', 'bg-ivory text-ink'];
const toneOf = (name: string) => TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

/**
 * A person's (or organizer's) picture from Sinc, with their initials when there is none or it fails to load.
 * Decorative by default: the name is always shown next to it.
 */
export function Avatar({ src, name, size = 32, square = false, className, label }: { src?: string | null; name?: string | null; size?: number; square?: boolean; className?: string; label?: string }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before the page became interactive never fires onError for React; check once mounted.
  useEffect(() => {
    setBroken(false);
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [src]);
  const shape = square ? 'rounded-[8px]' : 'rounded-full';
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (src && !broken)
    return (
      <img
        ref={img}
        src={src}
        alt={label ?? ''}
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={clsx('shrink-0 bg-fog object-cover', shape, className)}
        style={style}
      />
    );
  return (
    <span aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} className={clsx('inline-flex shrink-0 select-none items-center justify-center font-medium', shape, toneOf(name ?? '?'), className)} style={style}>
      {initialsOf(name)}
    </span>
  );
}
