# EventCheckin - Feature Specification

Master spec from the original claude.ai planning chat. Steps 1-6 are built in order.

## Overview

Event check-in web app for organizers with 50-500 registrations. Staff use phones/tablets at
entrances to check in attendees. Organizers get live dashboards and reports.

### Organizer (Admin)
1. Create account with organization
2. Create events with auto-generated unique IDs
3. Import guest lists (CSV/Excel)
4. Manage staff accounts with different roles
5. View live check-in dashboard
6. Print attendee badges
7. Export reports post-event
8. View audit logs and event history

### Staff (Door/Check-in)
1. Check in guests by email or phone
2. Handle walk-ins with form
3. Print badges on demand
4. View check-in count and status
5. No event editing permissions

### Attendee (Guest)
1. Scan QR code at entrance
2. Enter email or phone to check in
3. See confirmation (green/amber/red)
4. Become walk-in if not registered

## Architecture

- Multi-tenant isolation with Postgres Row-Level Security on all tables
- Organizer A never sees Organizer B's data
- Service role key is server-only
- Tables: organizations, profiles, events, registrations, checkins, badge_prints,
  import_jobs, admin_actions (see `SQL/001_init_schema.sql`)

## Design System

- Colors: primary green `#10b981`, amber `#f59e0b`, error red `#ef4444`, neutral light
  `#f3f4f6`, neutral dark `#1f2937`, border `#d1d5db`, text `#111827` / `#6b7280`
- System fonts; 16px body, 14px secondary, 20px section headers, 28px page headers,
  18px minimum on the check-in screen
- Flat design, no gradients; border-only cards and secondary buttons
- 44px minimum touch targets; responsive 360px to 1280px+; 16px minimum side gutters
- Alerts: colored left border

## Step 1: Login & Event Management (done)

- `/login`, `/signup` (creates organization + admin profile)
- `/events`: list of the org's events with name, location, date, event ID, status
- `/events/create`: name, location, date, capacity (default 500), generated event ID,
  per-org uniqueness check
- `/events/[id]`: details, check-in URL, links to later steps
- Event ID format `NAME-LOCATION-DDMONYYYY`, e.g. `TECHFEST-BLR-15NOV2026`

## Step 2: Guest List Management

Page: `/events/[id]/guests`

- CSV/Excel upload with column mapping
- Remember mapping for next upload
- Duplicate detection (email OR name+company)
- Flag duplicates with options: keep first, keep second, keep both
- Manual add form: full name, email, phone, designation, company, company email
- Registration ID auto-generated (6-char, e.g. `A7K9Q2`)
- List view with search/filter
- Bulk actions: delete, export

Success: CSV/Excel upload with mapping, duplicates flagged with options, manual add works.

## Step 3: Check-in Screen

Page: `/checkin/[eventId]` (no login)

- Mobile-first, 18px minimum text, one input (email or phone) + "Check In" button
- Green: found and not checked in. Shows name, company, time; auto-clears after 3 seconds
- Amber: already checked in. Shows earlier check-in time, records no second check-in;
  optional "Check in as walk-in anyway?"
- Red: not found. "Register as walk-in" opens the walk-in form
- Walk-in form: full name, designation, company (required), company email (validated);
  creates a `walkin` registration and a check-in
- Optional guest search (name, email, phone), logged with staff name
- Case- and space-insensitive matching; network errors never dropped silently
- Rate limiting: 10 requests/second per IP on the check-in endpoint

## Step 4: Live Dashboard

Page: `/events/[id]/dashboard`

- Supabase Realtime (no polling), manual Refresh fallback
- Stats: total registered, checked in, walk-ins, not yet arrived, no-shows
- Live feed of latest 20 check-ins
- Close check-in (marks remaining as no-show, blocks new check-ins) / reopen

## Step 5: Badge Printing

Page: `/events/[id]/badges`

- Preview: name and designation (editable, saved to registration), company, event name,
  registration ID as text
- Print per registration; records printed_at and printed_by
- Shows last print ("Last printed: Oct 26 at 2:30 PM by John"); re-print allowed
- PDF via pdf-lib or @react-pdf/renderer

## Step 6: Export Reports

- One-click export to Excel, CSV, PDF
- Attendee list (name, email, phone, company, designation), check-in time, source,
  status (checked in / no-show), walk-ins section, summary totals

## Security & Roles

- Email/password via Supabase Auth; organizers sign up as admin
- Staff invited with a role: Admin, Check-in Staff, Badge Printer, Admin Staff
- Public check-in can only check in, never read the guest list

## Out of Scope (MVP)

No payments, offline mode, native app or separate admin page. English only.
