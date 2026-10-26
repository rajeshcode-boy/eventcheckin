# EventCheckin Step 1: Complete

## What Was Built

### Pages (Completed)
- ✅ `/login` – Email/password login
- ✅ `/signup` – Create organizer account (creates organization + profile)
- ✅ `/events` – List organizer's events (home page)
- ✅ `/events/create` – Create new event with auto-generated ID
- ✅ `/events/[id]` – Event detail page with check-in URL

### Database (Completed)
- ✅ `organizations` table
- ✅ `profiles` table (links to Supabase Auth)
- ✅ `events` table (with unique event_id)
- ✅ `registrations` table (structure ready for Step 2)
- ✅ `checkins` table (structure ready for Step 3)
- ✅ `badge_prints` table (structure ready for Step 5)
- ✅ `import_jobs` table
- ✅ `admin_actions` table (audit log)

### Security (Completed)
- ✅ Row-Level Security (RLS) on all tables
- ✅ Organizers see only their own organization's data
- ✅ Service role key in env vars only (never in browser)
- ✅ Anon key with RLS restrictions in browser
- ✅ Public check-in function with rate-limiting placeholder

### Features
- ✅ Auto-generate unique event IDs: `NAME-LOCATION-DDMONYYYY`
  - Example: `TECHFEST-BLR-15NOV2026`
  - Handles collisions (same name, location, date)
  - Never changes if organizer edits event
- ✅ Event pagination (5-10 per page)
- ✅ Session management with Supabase Auth
- ✅ PWA support (manifest.json + service worker)
- ✅ Responsive design (360px to 1280px+)

---

## How to Run Locally

### Prerequisites
- Node.js 18+ and npm
- Supabase account (free at supabase.com)

### Setup (5 minutes)

1. **Create Supabase project:**
   - Go to supabase.com → Create project
   - Copy project URL and anon key

2. **Clone/setup project:**
   ```bash
   cd event-checkin
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   npm install
   ```

3. **Run database migrations:**
   - Open Supabase → SQL Editor
   - Copy entire `SQL/001_init_schema.sql` → Run
   - Copy entire `SQL/002_rls_policies.sql` → Run

4. **Start dev server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

### Run Tests
```bash
npm test
# or watch mode
npm run test:watch
```

---

## Test Checklist (Do This First)

Use this to verify Step 1 works:

- [ ] **Sign up:** Create account with email `test1@example.com`, password, and organization name
- [ ] **Land on events page:** After sign up, you see empty events list
- [ ] **Create event:** 
  - Name: "Tech Fest"
  - Location: "Bengaluru"
  - Date: "Nov 15, 2026"
  - Capacity: "500"
  - Click "Generate ID" → See `TECHFEST-BLR-15NOV2026`
  - Click "Create Event"
- [ ] **Event appears:** Event shows in list with correct ID
- [ ] **Event detail page:** Click event → See check-in URL, capacity, status
- [ ] **Multiple locations:** Create same event name with location "Delhi" on same date → Get different event ID (`TECHFEST-DEL-15NOV2026`)
- [ ] **Logout:** Click logout
- [ ] **RLS test:** Sign in as `test2@example.com` → See no events (RLS working)
- [ ] **Back to first account:** Sign in as `test1@example.com` → See your event still there
- [ ] **Pagination:** Create 10+ events → See "Next" button

✅ **All pass?** Step 1 is ready. Proceed to Step 2 (guest list import).

---

## Environment Variables

| Variable | Where to Find | Example |
|----------|---------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | `eyJhbGc...` |
| `NEXT_PUBLIC_APP_URL` | Your app's URL | `http://localhost:3000` or `https://myapp.vercel.app` |

⚠️ **NEVER commit `.env.local` to Git. Add to `.gitignore`.**

---

## Decisions Made (On Your Behalf)

### Event ID Format
- Using `NAME-LOCATION-DDMONYYYY` (e.g., `TECHFEST-BLR-15NOV2026`)
- Alternative considered: `NAME-LOCATION-MONTHYEAR` would lose day distinction for same date/location
- ✅ **This format allows same event name on same date but different locations**

### Auto-Organizer on Signup
- Organizer who signs up is automatically an `admin` role
- Staff accounts added later with different roles (decided in refinement)

### Check-in URL
- Format: `/checkin/{event_id}` (e.g., `/checkin/TECHFEST-BLR-15NOV2026`)
- Public page (no auth required) for guests to access
- QR code points here for mobile check-in

### Realtime on Step 4
- Using Supabase Realtime (cheaper than polling)
- Fallback: Manual "Refresh" button if Realtime disconnects

---

## What's NOT in Step 1 (Deliberately)

- ❌ Guest import (Step 2)
- ❌ Check-in screen (Step 3)
- ❌ Live dashboard (Step 4)
- ❌ Badge printing (Step 5)
- ❌ Reports/export (Step 6)
- ❌ Admin page
- ❌ Email confirmations
- ❌ Offline mode
- ❌ Native mobile app
- ❌ Payments

These are placeholders in the event detail page for visibility.

---

## File Structure

```
event-checkin/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                    # Protected pages
│   │   ├── events/page.tsx       # List events
│   │   ├── events/create/page.tsx # Create event
│   │   ├── events/[id]/page.tsx  # Event detail
│   │   └── layout.tsx            # Auth + header
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   └── supabase.ts               # Helpers + event ID generation
├── public/
│   ├── manifest.json             # PWA
│   └── sw.js                     # Service worker
├── SQL/
│   ├── 001_init_schema.sql       # Tables
│   └── 002_rls_policies.sql      # RLS + public check-in function
├── tests/
│   └── event-creation.test.ts    # Unit tests
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## Next Steps After Passing Tests

1. **Step 2: Guest List Import**
   - CSV/Excel upload with column mapping
   - Duplicate detection (by email or name+company)
   - Manual guest add
   - Registration ID generation (6-char unique per event)

2. **Step 3: Check-in Screen**
   - Public `/checkin/[eventId]` page (no auth)
   - Email/phone input
   - Manual search option
   - Walk-in form
   - Real-time feedback (green = checked in, amber = already checked in, red = not found)

3. **Step 4: Live Dashboard**
   - Real-time check-in count
   - Latest 20 check-ins feed
   - "Close check-in" button (mark remaining as no-shows)

4. **Step 5: Badge Printing**
   - Badge preview
   - Print history tracking
   - Allow re-printing

5. **Step 6: Export Reports**
   - Excel/CSV/PDF export
   - Attendee list + check-in times
   - Walk-ins, no-shows

---

## Issues or Questions?

File an issue or message if:
- Setup steps are unclear
- Tests fail
- Migrations don't run
- RLS not working
- Need clarification on design decisions
