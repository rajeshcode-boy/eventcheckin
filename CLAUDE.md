# EventCheckin — project reference

Read this before making a change. It is project context and working rules,
not a tutorial — see `README.md` for setup steps.

## What this is

EventCheckin is a web app for event organisers: guest lists, public
self-registration links with team referral codes, QR check-in, digital
badges, desk badge pickup, dashboards, and web push notifications
(including "Add to Home Screen" on iOS).

## Stack

- **Next.js 15** (App Router, client components), **React 19**, **TypeScript**.
- **Supabase**: Postgres with Row Level Security (RLS), Auth (email/password),
  Storage (`branding` and `avatars` buckets, both public), SECURITY DEFINER
  RPCs for anon/public access, Realtime for the live dashboard.
  Project id: `noultxhwoyanalvgstbq` ("EventCheckIn", region ap-northeast-2).
- **Vercel**: auto-deploys `main` to production. Preview deployments build
  from every branch/PR and need their own copy of the env vars (see below).
- **Analytics**, all behind one cookie consent banner (see rule 12):
  - **PostHog** (US Cloud): product analytics, session replays with all text
    and inputs masked, and error tracking (`capture_exceptions`). Organisers are
    identified by account ID only. Dashboard: "EventCheckin growth".
  - **Google Analytics 4** (`G-NJXY2K8DVN`): public website pages only.
    "Page changes based on browser history events" is turned off in GA's
    enhanced measurement, because the app sends page views itself.
  - **Vercel Web Analytics**: cookie-free visit counts, always on.
- **Vitest** for unit tests (`npm test`). `npx tsc --noEmit` for type checking.
- Styling is Tailwind utility classes plus the shadcn components in
  `components/ui` (Tailwind 4, Base UI). Colours come from the CSS variables in
  `app/globals.css` (light/dark via `prefers-color-scheme` + `data-theme`),
  exposed to Tailwind as theme tokens. Older pages still use inline styles and
  the legacy `.btn-*` / `.card` / `.input-field` / `.alert-*` classes while they
  are migrated.

## Layout

- `app/page.tsx` — the public website home page, built from
  `components/home/` (header, footer, demo; copy and links such as the
  Calendly booking URL live in `components/home/content.ts`). Signed-in
  organisers are redirected to `/events`. `app/privacy/` and `app/terms/` are
  the legal pages; keep the Privacy Policy in step with any new tracking or
  data processor.
- `components/Analytics.tsx` + `lib/analytics.ts` — the consent banner and
  the PostHog / Google Analytics loaders, with the lists of which pages each
  tool may run on.
- `app/(app)/` — signed-in organiser pages, wrapped by `app/(app)/layout.tsx`
  (header, nav, auth guard via `supabase.auth.getSession()`).
- `app/(app)/events/[id]/` — one event's pages, wrapped by a shared sidebar
  layout (`layout.tsx`): Overview, Guests, Dashboard, Badge design, Badges,
  Pickup, Settings.
- `app/(auth)/` — login/signup, no auth guard.
- `app/checkin/[eventId]/`, `app/register/[token]/`, `app/badge/[token]/` —
  **public, unauthenticated** pages reached by QR code or shared link.
- `app/api/` — the only two server routes: `checkin` (public check-in/walk-in,
  rate-limited) and `push/send` (organiser's own test notification, needs a
  Supabase access token).
- `lib/supabase.ts` — the browser Supabase client (anon key). `lib/push/`
  holds server-only push code (service role key) — never import
  `lib/push/server.ts` from a client component.
- `SQL/NNN_description.sql` — migrations, applied in order, append-only
  (see rules below).

## Code rules — follow these, and ask before breaking one

1. **Never commit secrets.** No real key, token, or connection string in any
   file, commit message, or PR body. `.env.local` is gitignored; `.env.example`
   only has placeholder values. The user types real values into `.env.local`
   and Vercel themselves — never ask them to paste a secret into chat.
2. **New RPCs that anon/authenticated can call must be SECURITY DEFINER,
   `SET search_path = public`, and `REVOKE ... FROM PUBLIC` before
   `GRANT ... TO anon, authenticated`.** Match the existing pattern in
   `SQL/005`, `SQL/009`–`012`. Never grant a table directly to `anon`; go
   through a function that validates input first.
3. **Any data a public/anon function returns is data anyone with its token
   or ID can read — assume it will be read by a stranger.** Before adding a
   column to a public RPC's return type, ask: would it matter if a stranger
   saw this? (Known gap, accepted by the user: `public_check_in_guest` in
   `SQL/010_digital_badges.sql` returns `badge_token` to anyone who supplies
   a valid email/phone + event ID, because the check-in page's on-screen
   badge currently depends on it. Don't widen this further without asking.)
4. **RLS policies scope every organiser-facing table to `current_org_id()`**
   (see `SQL/002_rls_policies.sql`). A new table needs the same scoping — a
   `SELECT`/`UPDATE`/`INSERT` policy keyed on `organization_id`, or routed
   through a SECURITY DEFINER function. Don't add a table without RLS enabled.
5. **SQL migrations are append-only.** Add a new `SQL/0NN_name.sql` file; don't
   edit an already-applied one. Each file ends with `NOTIFY pgrst, 'reload
   schema';` so PostgREST picks up new functions immediately.
6. **Applying a migration to the live Supabase project, or merging/pushing to
   `main`, needs the user's explicit go-ahead first** — even if the SQL file
   is already written and reviewed. Same for anything that touches
   production data.
7. **The service worker (`public/sw.js`) must never cache pages or `/api/`
   responses** — only same-origin static assets (`/_next/static/`, `/icons/`,
   the manifest). Caching a signed-in page or API response risks showing one
   person's data to the next person on a shared device. Bump `CACHE_NAME`
   (e.g. v2 → v3) whenever the cached file list changes, so old caches clear.
8. **Preview deployments need their own environment variables.** Vercel
   environment variables are scoped to Production/Preview/Development
   separately — adding a var to Production does not make it available to PR
   builds. If a PR's Vercel check fails with `missing_config` or
   "`<X> is required`", check whether the var is set for **Preview**, not
   just Production.
9. **Styling**: write Tailwind utility classes and use the shadcn components
   in `components/ui`. Take colours from theme tokens (`bg-card`,
   `text-muted-foreground`, `border-border`, `text-primary`, ...) that map to
   the CSS variables in `app/globals.css`, never hardcoded colours, so
   light/dark theming stays consistent. Don't add new inline `style={{}}`
   blocks or new legacy `.btn-*` / `.card` / `.input-field` / `.alert-*` usage;
   convert a page when you touch it. Global element resets belong in
   `@layer base`, because unlayered CSS overrides every Tailwind utility.
10. **Before merging a PR or pushing to `main`, run `npx tsc --noEmit`,
    `npm test`, and `npm run build` locally** (or confirm CI/Vercel ran them)
    — don't rely on the PR's Vercel check alone, since it only proves the
    build succeeds, not that tests pass.
11. **Rate limiting in `app/api/checkin/route.ts` is in-memory per server
    instance and trusts the client-supplied `x-forwarded-for` header** — known
    to be weak, not a real abuse defense. Don't treat it as one when reasoning
    about security; flag it if asked to harden the app further.
12. **Analytics only after consent, never on guest pages.** PostHog and
    Google Analytics load only after the visitor clicks Accept in the banner,
    and each is switched off by a missing env var. Guest-facing pages
    (`/checkin`, `/register`, `/badge`, `/pass`, `/kiosk`, `/api`) are never
    tracked (`isTrackedPath`). Google Analytics runs only on `/`, `/signup`,
    `/login`, `/privacy` and `/terms` (`isGaPath`). Never send names, emails,
    phone numbers or guest details to either tool: identify organisers by
    account ID only, and keep PostHog's text and input masking on. Adding a
    tracking tool, widening either page list, or turning off masking needs the
    user's go-ahead and a matching Privacy Policy update.

## Known accepted gaps (don't "fix" these without asking first)

- `public_check_in_guest` returns `badge_token` to any caller with a valid
  email/phone + event ID (see rule 3). Kept deliberately for now.
- No CAPTCHA or stronger abuse limit on public registration
  (`public_register_online`) or check-in.
- No CSP / `X-Frame-Options` / security headers configured in
  `next.config.ts`.
- `remove_push_subscription` lets any anon caller delete a subscription by
  endpoint (low risk — endpoints aren't realistically guessable).
- Error tracking only covers visitors who accepted cookies, on tracked pages.
  Errors on guest pages and in server routes are not reported anywhere.
  Sentry was discussed as the fix and deferred.

## Before adding a feature

1. Check this file and the relevant `SQL/*.sql` files for existing patterns —
   don't reinvent an RPC shape or RLS pattern that already exists.
2. If the feature touches a public (anon-callable) surface, re-read rule 3
   above and ask the user if unsure.
3. If it needs a schema change, write a new numbered `SQL/` file but **do not
   apply it to Supabase or merge to `main` without asking the user first.**
4. Run `npx tsc --noEmit`, `npm test`, and `npm run build` before calling the
   work done.
