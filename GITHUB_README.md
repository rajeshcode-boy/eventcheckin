# EventCheckin 🎟️

A modern, production-ready **event check-in web app** for small to medium event organizers (50-500 registrations).

Staff use phones/tablets at the entrance to check in attendees. Organizers get live updates on a dashboard. Build in Next.js + Supabase.

## Features (Step 1: Complete ✅)

- **Organizer Login & Signup** – Email/password authentication
- **Event Management** – Create events with auto-generated unique IDs
- **My Events Dashboard** – List of organizer's events
- **Event Details** – Check-in URL, capacity, status
- **Multi-Tenant Security** – Row-Level Security isolates organizations
- **PWA Support** – Installable on phones
- **TypeScript + Tailwind** – Modern, type-safe, responsive

## Steps (Roadmap)

| Step | Feature | Status |
|------|---------|--------|
| 1 | Login, events, create event | ✅ Complete |
| 2 | Guest list import + duplicates | ⏳ Next |
| 3 | Check-in screen (public) | ⏳ Coming |
| 4 | Live dashboard | ⏳ Coming |
| 5 | Badge printing | ⏳ Coming |
| 6 | Export reports | ⏳ Coming |

## Quick Start (5 Minutes)

### Prerequisites
- Node.js 18+
- Free Supabase account (supabase.com)

### Setup

1. **Create Supabase project**
   - Go to supabase.com → Create project
   - Copy Project URL and anon key

2. **Clone and configure**
   ```bash
   git clone https://github.com/yourusername/eventcheckin.git
   cd eventcheckin
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Run database migrations**
   - Open Supabase → SQL Editor
   - Copy-paste `SQL/001_init_schema.sql` → Run
   - Copy-paste `SQL/002_rls_policies.sql` → Run

4. **Start development server**
   ```bash
   npm install
   npm run dev
   ```

5. **Test it**
   - Open http://localhost:3000
   - Sign up with test email
   - Create an event named "Tech Fest", location "Bengaluru", date "Nov 15, 2026"
   - See event appear in list

✅ Done!

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** – Get running in 2 minutes
- **[README.md](./README.md)** – Full setup guide + troubleshooting
- **[STEP1_SUMMARY.md](./STEP1_SUMMARY.md)** – What was built + test checklist
- **[ENV_VARIABLES.md](./ENV_VARIABLES.md)** – Environment variables explained
- **[DECISIONS_MADE.md](./DECISIONS_MADE.md)** – Architectural decisions + rationale

## Architecture

```
Frontend (Next.js 15)
    ↓
Supabase Auth
    ↓
PostgreSQL (with Row-Level Security)
    ↓
API (RLS enforces multi-tenant isolation)
```

**Key: RLS (Row-Level Security) prevents data leaks between organizations**

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **Security:** Row-Level Security (RLS), Service role key server-only
- **Hosting:** Vercel (recommended)
- **Testing:** Jest + React Testing Library

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous key (safe in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-only) |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL |

See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for details.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## Deployment

### Vercel (Recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Go to vercel.com → Import repo
# 3. Add environment variables
# 4. Deploy (1 click)
```

Your app: `https://yourname.vercel.app`

## Database Schema

```
organizations          Events belong to organizations
├── profiles          Users linked to auth
├── events            Event metadata
│   ├── registrations Guest list
│   ├── checkins      Check-in records
│   └── badge_prints  Print history
├── import_jobs       CSV/Excel imports
└── admin_actions     Audit log
```

All tables have Row-Level Security (RLS) policies.

## Security

- ✅ **RLS Enforced:** Organizers can only see their own events
- ✅ **Service Key Secure:** Admin key never exposed to browser
- ✅ **Anon Key Limited:** RLS restricts what unauthenticated users can access
- ✅ **HTTPS Only:** All connections encrypted
- ✅ **Rate Limiting:** (Step 3+) Check-in endpoint will be rate-limited

## Testing

```bash
npm test
```

Tests cover:
- Event ID generation (uniqueness, format)
- Registration ID generation (6-char alphanumeric)
- Email validation

## Contributing

This is an open project. Feel free to:
- Report issues
- Submit pull requests
- Fork and customize

## Roadmap

- Step 2: Guest list import with duplicate detection
- Step 3: Public check-in screen (mobile-optimized)
- Step 4: Real-time dashboard
- Step 5: Badge printing + print history
- Step 6: Export reports (Excel/CSV/PDF)
- Step 7: Staff management + roles
- Step 8: Admin page + settings

## License

MIT

## Support

- 📖 **Documentation:** See [README.md](./README.md)
- 🚀 **Getting Started:** See [QUICK_START.md](./QUICK_START.md)
- 🔧 **Troubleshooting:** See [README.md](./README.md#troubleshooting)
- 🎯 **Architecture:** See [DECISIONS_MADE.md](./DECISIONS_MADE.md)

## Author

Built with Next.js, Supabase, and TypeScript.

---

**Next Step:** Follow [QUICK_START.md](./QUICK_START.md) to get running in 5 minutes! 🚀
