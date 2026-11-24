import type { Metadata } from 'next';

// The reset token is in the URL: never send it to other sites as a referrer.
export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
