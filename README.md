# Sinc Admin Console (web)

Staff-only Next.js app for running Sinc day to day. It talks to the admin service (`../admin`) through `/admin-api`. The full plan is in `docs/SINC_ADMIN_DASHBOARD_PROMPT.md`.

**Built so far (Phases 0–3):** sign-in with mandatory 2FA, the shell (rail, top bar, scope pill, ⌘K command palette), Overview, Live, Money, Transactions, Growth (including where people use Sinc from: access countries, visitors, home countries, VPN and roaming counts, retention cohorts, lifecycle, funnel), Marketplace, Engagement, Users and User 360 (location and access panel, audited PII reveal), Organizers and Organizer 360, Events and Event 360, saved views, CSV exports (audited), Staff & roles and Audit log. Map, Queues, Health, Comms, Catalog and Feature flags show an honest "Arrives in Phase N" panel. No sample numbers appear anywhere except the labelled gallery.

## Run locally

```bash
# 1. admin service on :8005 (see ../admin/README.md), plus the user service on :8001
# 2. web app on :3005
cd admin-web
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3005 and sign in with the seed admin (`team@sinc.today`). The first sign-in claims the owner seat and asks you to scan a QR code with an authenticator app.

## How it fits together

- `/admin-api/*` is rewritten to `ADMIN_API_URL` (next.config.ts). The browser only ever talks to this app's origin, so the `sinc_admin_sid` session cookie stays first-party, HttpOnly and SameSite=Strict.
- `src/app/(console)/layout.tsx` checks the session on the server (`GET /me`) and redirects to `/login` when it's missing or expired.
- Global scope (date range, comparison, country, currency) lives in the URL via `nuqs` (`src/lib/scope.ts`) and is carried across pages by the rail.
- Permissions from `/me` hide nav items and gate pages; the admin service enforces them again on every request.

## Design system ("Ledger")

- Tokens: `src/app/globals.css` is the only file with hex values. Tailwind utilities come from its `@theme` block (`bg-ash`, `text-ink-muted`, `rounded-panel`, ...).
- Fonts: Inter Tight 400 (display) and Inter (UI), self-hosted from `src/fonts` under the SIL OFL. If Sinc licenses PolySans, drop the woff2 files into `src/fonts` and point the `display` font in `src/app/layout.tsx` at them.
- Primitives: `src/components/ui.tsx` (Button, Tag, StatusBadge, Delta, Panel, FeaturePanel, KpiTile, Field, EmptyState, ErrorState, Skeleton).
- Gallery: `/design-system`, visible in development, or in production builds made with `NEXT_PUBLIC_SHOW_DESIGN_SYSTEM=1`.
- Contrast: `npm run test:contrast` checks every token pair the components use against WCAG 2.2 AA. Add it to CI.

## Environment

| Variable | Purpose |
|---|---|
| `ADMIN_API_URL` | Where `/admin-api` is proxied (dev `http://localhost:8005`, prod the internal admin service or API gateway) |
| `SINC_ENV` | `production`, `staging` or `development`. Drives the PROD/QA/DEV tag in the top bar; unset shows DEV |
| `NEXT_PUBLIC_SHOW_DESIGN_SYSTEM` | `1` to expose `/design-system` in a production build |

In production set the admin service's `ADMIN_WEB_ORIGIN=https://admin.sinc.today` so its CSRF check accepts this app.
