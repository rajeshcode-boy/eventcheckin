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

- `/events/[id]/speakers` – Speaker lineup, talk topics, session stages/times, and photo upload
- `/events/[id]/sponsors` – Sponsor hub with custom tier naming, booth allocation, staff pass quotas, and rep roster
- `/events/[id]/desk` – Live Gate Station with real-time arrivals, kiosk monitoring, and sponsor booth teams view

### Database Tables

- `organizations` – Organizer companies
- `profiles` – Users linked to Supabase Auth
- `events` – Events with auto-generated IDs
- `registrations` – Guest list
- `checkins` – Check-in records
- `badge_prints` – Badge print history
- `import_jobs` – CSV/Excel import tracking
- `admin_actions` – Audit log
- `event_speakers` – Speaker profiles, keynotes, panel sessions, stages, and badges
- `event_sponsors` – Sponsor companies, custom tiers, booth allocations, and pass quotas
- `event_sponsor_reps` – Sponsor booth staff passes, live gate attendance, and contact privacy isolation

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

## Modern Platform Evolution & Implemented Features (Production Release)

Following the initial Step 1 foundation, the application has evolved into a full-scale, Canva Studio-grade event operations and check-in platform. Below is the complete record of architecture and capabilities currently active in production:

### 1. Canva-Style Event Creation Studio (`/events/create` & `/events/[id]/edit`)
- **2-Column Split-Screen Studio Layout**:
  - **Left Form Pane (58% width)**:
    - **1. Event Essentials**: Title input with live character counter (`0/120`), searchable Country and City autocompletes, and 1-tap **Guest Capacity preset pills** (`100`, `250`, `500`, `1,000`, `2,500`).
    - **2. Date & Schedule**: Event Date, Start Time, and auto-computed timezone pill (`Detected Timezone: Asia/Kolkata`, `America/New_York`, etc.).
    - **3. Venue & Location**: Interactive segmented cards (`🏢 In-Person`, `💻 Virtual`, `⏳ To Be Announced`) revealing hotel/venue fields, address, Google Maps link, or virtual platform meeting URL.
    - **4. Studio Branding**: Dropzones for Event Banner (4:1 ratio) and Event Logo (1:1 ratio) with pixel and file size validation.
  - **Right Sticky Simulator Pane (42% width)**:
    - **Real-Time Live Simulator**: Updates instantly as the organizer types name, selects date, changes capacity, or alters venue.
    - **Physical Attendee Pass Simulator**: Tactile ticket design with perforated cutouts, VIP badge pill, demo attendee details, and live vector **Gate QR Code** (`QRCodeSVG`).
    - **Public Check-in Portal Preview**: Browser mockup showing the attendee self-registration and check-in portal.
  - **Mobile Responsive**: 1-tap toggle between `📝 Event Details` and `🎟️ Live Simulator`.

### 2. Unified Live Gate Station (`/events/[id]/desk`)
- **Consolidated Event Operations Desk**: Merged real-time arrival stream and desk tools into a unified station with segmented toggle (`📋 Attendee Roster` | `⚡ Live Arrival Stream`).
- **Active Connected Kiosks Indicator**: Live status chip in header showing active connected tablets (`📱 X Kiosk(s) Online (Y paired)` vs `0 Kiosks Connected`) with realtime 20s presence heartbeat and 1-click shortcut to device management.
- **Multi-Method Check-in Tracking & Attribution**: Every attendee check-in records and displays its exact arrival method across the Roster and Live Arrival Stream:
  - `📱 Kiosk QR: [Kiosk Label]` or `📱 Kiosk Search: [Kiosk Label]` (entrance kiosk tablets)
  - `📷 Desk QR Scanner` (camera QR scanner with operator attribution)
  - `🌐 Self Check-in` (guest smartphone self-arrival)
  - `✍️ Desk Manual: [Staff Name]` (1-tap desk check-in with staff operator attribution)
  - `🚶 Walk-in Desk` (on-site walk-in registration)
- **Live Arrival Stream**: Real-time ticker showing attendee check-in timestamps, check-in method badge, VIP tags, and door velocity.
- **KPI Metrics & Telemetry**: Instant velocity tracking, peak arrival rate (arrivals/min), and total gate throughput.
- **Roster & Fast Search**: Instant attendee search by name, email, or badge code, with 1-click manual check-in/undo.
- **Status Controls**: Instant one-click toggle to close or reopen check-in registration.
- **One-Click Report Exports**: Export check-in logs in CSV, Excel (`.xlsx`), and print-ready PDF formats.

### 3. Organizer Action Center (Notification Hub)
- **Top Utility Bar Bell**: Replaced passive check-in alert spam with an active, actionable event management center.
- **Two Focused Tabs**:
  - **`⚠️ Action Required`**: Pre-flight alerts for upcoming events with missing venues, unassigned start times, or closed registrations, plus pending attendee approval requests with direct action links (`Fix Details`, `Review Approvals`).
  - **`✨ Workspace Updates`**: Milestones, capacity thresholds (e.g. 80% filled), and team additions.
- **Realtime Synced Status**: Replaced confusing indicators with clear real-time synchronization (`● Realtime Synced`).

### 4. Bento Event Overview Dashboard (`/events/[id]`)
- **3-Zone Bento Architecture**:
  - **Zone 1 (Header Strip)**: Event title, date-aware lifecycle status badge (strictly shows `● Live` only on the event day itself; shows `● Active` or `○ Deactivated` prior to event day), header event activation toggle switch, 1-click copy Event ID chip (`NAME-CITY-DDMONYYYY`), and contextual intelligence alerts.
  - **Zone 2 (Capacity & Arrival Meters)**: Visual progress bar (`X / Y spots filled • Z%`) and live arrival velocity bar.
  - **Zone 3 (Unified Access & Registration Hub)**: 2-tab switchable panel for Guest Registration Portal and Gate Kiosk link with embedded vector QR codes, modern accessible toggle switch (`Registration Open` / `Registration Paused`) with role-based restrictions (Admin & Manager only), copy buttons, and direct launch triggers.
- **Regional Holidays**: Context-aware public holidays strip filtered specifically for the event's location and month.

### 5. Universal Responsive Breadcrumbs
- Standardized navigation (`Events › [Event Name] › [Active Section]`) across all event routes:
  - Overview (`/events/[id]`)
  - Gate Station (`/events/[id]/desk`)
  - Guest List (`/events/[id]/attendees`)
  - Badges (`/events/[id]/badges`)
  - Team (`/events/[id]/team`)
  - Settings (`/events/[id]/edit`)
  - Event Creation (`/events/create`)

### 6. Event Team & Role Permissions (`/events/[id]/team`)
- **2-Column Team Workspace**: Left column active team list; right column role permissions guide.
- **Role Permissions**:
  - `Admin`: Full workspace control, event lifecycle, imports, and exports.
  - `Staff`: Gate check-in, scanner access, badge printing, and attendee lookup.
- **On-Site Staff Badges**: Visual indicator distinguishing on-site check-in operators.
- **Team Invitations**: Invite colleagues by email with role assignment.

### 7. Kiosk Mode & Self-Service Check-in (`/kiosk/[event_id]`)
- **Self-Service Kiosk**: Full-screen kiosk interface designed for entrance iPads/tablets.
- **Camera QR Scanner**: Web camera QR scanning using `jsqr` with instant audible confirmation.
- **Search Fallback**: Fast name/email search for attendees who forgot their pass.
- **Offline Resilience**: Local caching prevents gate delays during venue Wi-Fi drops.

### 8. Badge Designer & PDF Generator (`/events/[id]/badges`)
- **Visual Badge Layout**: Configure attendee badges with event logo, custom fields, QR codes, and lanyard punch holes.
- **Batch PDF Printing**: Generate standard Avery or custom badge PDF sheets via `@react-pdf/renderer` and `pdf-lib`.

### 9. Attendee Imports & Approvals (`/events/[id]/attendees`)
- **CSV & Excel Import**: Drag-and-drop spreadsheets with intelligent column mapping and duplicate detection.
- **Registration Approval Mode**: Toggle between Auto-Approve and Manual Approval for VIP/private events.

### 10. Speaker Management & Program Sessions (`/events/[id]/speakers`)
- **Speaker Roster & Bios**: Dedicated directory for keynote and session speakers with headshots, company affiliations, and bios.
- **Session Topics & Stage Schedule**: Assign talk titles, session types (`Keynote`, `Panel`, `Breakout`, `Workshop`, `Fireside Chat`, `Lightning Talk`), session timing, and stage/room locations.
- **Automated Door Passes**: 1-click option to automatically issue and link an attendee QR pass to the guest list.

### 11. Sponsor & Partner Hub with Custom Tiers (`/events/[id]/sponsors`)
- **Full Organizer Custom Tier Naming**: Organizers can create and name any sponsor tier (e.g. *Title Partner*, *Lead Innovation Partner*, *Badge Lanyard Sponsor*, *Powered By*, *Community Partner*), assisted by quick suggestion chips.
- **Tier-Grouped Directory**: Visual sponsor cards grouped by their custom tiers with logos, website links, and contact details.
- **Booth Allocations & Staff Pass Quotas**: Track exhibition booth numbers (`Booth B-12`) and manage complimentary staff pass quotas per partner.

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
