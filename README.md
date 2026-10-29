# EventCheckin - Event Check-in Web App

A working web app for small event organizers (50-500 registrations) to manage check-in at the entrance.

## Features (Step 1: Login & Events)

- Email/password login with Supabase Auth
- Organizers see only their own events
- Create new events with auto-generated unique IDs
- Event list with pagination (5-10 events per page)

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend & Database:** Supabase (PostgreSQL, Auth, Realtime)
- **Security:** Row-Level Security (RLS) on all tables
- **Hosting:** Vercel

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project (note the URL and anon key)
3. Wait for the database to be initialized

### 2. Add Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   **Where to find these:**
   - Go to your Supabase project → Settings → API
   - Copy "Project URL" and "anon public" key
   - Copy "service_role" secret key (keep this safe, never share)

### 3. Run Database Migrations

1. In Supabase, go to SQL Editor
2. Create a new query and copy-paste the contents of `SQL/001_init_schema.sql`
3. Run the query
4. Create another query and copy-paste `SQL/002_rls_policies.sql`
5. Run the query

### 4. Install Dependencies

```bash
npm install
# or
yarn install
```

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create First Account

1. Click "Sign Up" on the login page
2. Enter email and password (use a test email like `test@example.com`)
3. You'll be logged in and redirected to the events page

---

## Environment Variables Explained

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (safe to expose in browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for unauthenticated access (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for admin operations (never expose to browser) |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL for redirects and QR codes |
| `DATABASE_URL` | PostgreSQL connection string (for migrations, optional for this step) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional. PostHog project key (`phc_...`). Turns on PostHog and the cookie banner |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional. `https://us.i.posthog.com` (default) or `https://eu.i.posthog.com` |
| `NEXT_PUBLIC_GA_ID` | Optional. Google Analytics 4 Measurement ID (`G-...`) for the public website |

In Vercel, add each variable for both **Production** and **Preview**, then redeploy without the build cache. `NEXT_PUBLIC_*` values are built into the site, so a change only takes effect after a new build.

---

## Analytics and error tracking

Nothing is tracked until a visitor clicks **Accept** in the cookie banner. "Cookie settings" in the website footer lets them change their mind.

| Tool | Where it runs | What it's for |
|------|---------------|---------------|
| PostHog | Public website and signed-in app | Page views, clicks, funnels, session replays (all text and typing hidden), error tracking |
| Google Analytics 4 | Public website only: home, sign up, log in, privacy, terms | Where visitors come from |
| Vercel Web Analytics | Every page, no cookies | Simple visit counts |

Guest pages (check-in, registration, pass, badge, kiosk) are never tracked by PostHog or Google Analytics. Organisers are identified in PostHog by account ID only, never by name or email.

- **PostHog dashboard:** "EventCheckin growth" (visitors per day, website pages, home → sign-up → app funnel, most-used app pages, rage clicks). Errors are under **Error tracking**.
- **Google Analytics:** check **Reports → Realtime**. Google's "Test your website" tool reports the tag as missing because it never clicks Accept; that's expected. Keep "Page changes based on browser history events" turned off under Admin → Data streams → Enhanced measurement.
- **To test:** open the site in a private window with no ad blocker, click Accept, and browse a few pages.

---

## What's Built (Step 1)

### Pages

- `/login` – Email/password login
- `/signup` – Create new organizer account
- `/events` – List organizer's events (home page)
- `/events/create` – Create new event

### Database Tables

- `organizations` – Organizer companies
- `profiles` – Users linked to Supabase Auth
- `events` – Events with auto-generated IDs
- `registrations` – Guest list (empty for now)
- `checkins` – Check-in records (empty for now)
- `badge_prints` – Badge print history (empty for now)
- `import_jobs` – CSV/Excel import tracking
- `admin_actions` – Audit log

### Security

- Row-Level Security (RLS) on all tables
- Organizers can only see their own data
- Service role key stays on server only
- Browser uses anon key with RLS restrictions

---

## Test Checklist

Use this to verify Step 1 works:

- [ ] Sign up with an email and password
- [ ] You land on the "My Events" page
- [ ] Click "Create Event"
- [ ] Enter "Tech Fest", location "Bengaluru", date "Nov 15, 2026", capacity "500"
- [ ] Submit the form
- [ ] Event appears in the list with ID like `TECHFEST-BLR-15NOV2026`
- [ ] Click "Show more" (if you have >5 events, which you don't yet)
- [ ] Log out
- [ ] Log in with a different email
- [ ] Verify you see NO events (RLS working)
- [ ] Log back in with first email
- [ ] Verify your event is still there

---

## Next Steps

After Step 1 passes the test checklist:

- **Step 2:** Import guest lists from CSV/Excel with duplicate detection
- **Step 3:** Build the check-in screen for attendees
- **Step 4:** Live dashboard with real-time updates
- **Step 5:** Badge printing
- **Step 6:** Export reports

---

## Project Structure

```
event-checkin/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (login, signup)
│   ├── (app)/              # Protected pages (events, dashboard)
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── components/             # Reusable React components
├── lib/                    # Utilities and helpers
├── public/                 # Static files (manifest, service worker)
├── SQL/                    # Database migrations
│   ├── 001_init_schema.sql
│   └── 002_rls_policies.sql
├── .env.example            # Template for environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md              # This file
```

---

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Add environment variables (same as `.env.local`)
5. Deploy

Your app will be live at `https://your-app.vercel.app`

---

## Troubleshooting

**"Missing Supabase environment variables"**
- Check `.env.local` has both URL and anon key
- Restart `npm run dev` after adding env vars

**"Database connection error"**
- Verify your Supabase URL is correct
- Check the database is initialized (go to Supabase → SQL Editor, run a test query)

**"Sign up not working"**
- Check email is valid
- Check password is >6 characters
- Check Supabase Auth is enabled (Settings → Auth)

**"RLS error when creating an event"**
- Make sure migrations 001 and 002 have run
- Check your profile exists in the `profiles` table (it should auto-create on sign-up)

---

## Support

This is Step 1 of the EventCheckin build. File issues or questions about setup.
