import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ash p-6">
      <div className="max-w-[480px] bg-canvas p-8" style={{ borderRadius: '6px 0 0 0' }}>
        <h1 className="display text-[32px] leading-[1.19] text-ink">Page not found</h1>
        <p className="mt-3 text-[14px] text-ink-secondary">This page doesn&apos;t exist in the admin console.</p>
        <Link href="/" className="link mt-5 inline-block text-[14px] text-ink">Go to Overview</Link>
      </div>
    </main>
  );
}
