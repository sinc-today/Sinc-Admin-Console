import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Providers } from './providers';
import './globals.css';

/*
 * Display face: PolySans if Sinc holds a web licence (swap this for
 * next/font/local pointing at the licensed woff2 files), otherwise Inter Tight.
 * Weight 400 only. Fonts are self-hosted from src/fonts (SIL OFL), so no
 * request goes to Google at build or run time.
 */
const display = localFont({
  src: '../fonts/inter-tight-latin-400.woff2',
  weight: '400',
  variable: '--font-display-face',
  display: 'swap',
});
const ui = localFont({
  src: '../fonts/inter-latin-var.woff2',
  weight: '100 900',
  variable: '--font-ui-face',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Sinc Admin', template: '%s · Sinc Admin' },
  robots: { index: false, follow: false },
};

// viewport-fit=cover lets the header and drawer respect the notch (env(safe-area-inset-*)).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('sinc-admin-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;if(localStorage.getItem('sinc-admin-density')==='compact')document.documentElement.dataset.density='compact'}catch(e){}` }} />
      </head>
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before React loads; ignore those. */}
      <body suppressHydrationWarning>
        <NuqsAdapter>
          <Providers>{children}</Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
}
