# EventCheckin - Quick Reference Card

Print this or bookmark it!

---

## 🚀 Get Running (5 Minutes)

```bash
# 1. Create Supabase project at supabase.com
# 2. Copy .env.example to .env.local
cp .env.example .env.local

# 3. Edit .env.local with Supabase keys:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY

# 4. Run SQL migrations in Supabase:
# - Copy SQL/001_init_schema.sql → Run
# - Copy SQL/002_rls_policies.sql → Run

# 5. Start dev server
npm install
npm run dev

# Open http://localhost:3000
```

---

## 📖 Documentation Map

| Doc | Read When | Time |
|-----|-----------|------|
| QUICK_START.md | You want to get running | 2 min |
| README.md | You need details/troubleshooting | 10 min |
| STEP1_SUMMARY.md | You want to test or see what's built | 5 min |
| ENV_VARIABLES.md | You need to understand secrets | 5 min |
| DECISIONS_MADE.md | You want to know why I chose what | 15 min |

**Start here:** QUICK_START.md

---

## 🧪 Test Event (Verify It Works)

```
Name: Tech Fest
Location: Bengaluru
Date: Nov 15, 2026
Capacity: 500

Expected Event ID: TECHFEST-BLR-15NOV2026 ✓
```

---

## 🔑 Environment Variables

| Variable | Type | Source |
|----------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase Settings → API |
| `NEXT_PUBLIC_APP_URL` | Public | `http://localhost:3000` |

**⚠️ Never commit `.env.local` (it's in .gitignore)**

---

## 🐛 Troubleshooting

| Error | Fix |
|-------|-----|
| "Missing Supabase env vars" | Check `.env.local` has all 3 keys, restart dev server |
| "Database connection error" | Verify URL in Supabase, check migrations ran |
| "RLS error on event creation" | Run both SQL files in Supabase SQL Editor |
| "Port 3000 in use" | Change port: `npm run dev -- -p 3001` |
| "TypeError: Cannot read property X" | Refresh browser, restart dev server |

**Full troubleshooting:** See README.md

---

## 🚀 GitHub & Deployment

```bash
# Push to GitHub
git remote add origin https://github.com/yourusername/eventcheckin.git
git push -u origin main

# Deploy to Vercel
# 1. Go to vercel.com
# 2. Import GitHub repo
# 3. Add env variables
# 4. Deploy
```

---

## 📁 File Locations

| File | Purpose | Edit When |
|------|---------|-----------|
| `.env.example` | Secrets template | Never |
| `.env.local` | Your secrets | Setup only |
| `app/globals.css` | Colors, buttons | Design changes |
| `lib/supabase.ts` | Event ID generation | Change ID format |
| `SQL/001_init_schema.sql` | Database tables | Add new tables |
| `SQL/002_rls_policies.sql` | Security rules | Change permissions |

---

## 🧪 Run Tests

```bash
npm test                # Run all tests
npm run test:watch     # Watch mode
```

Tests cover:
- Event ID generation
- Registration ID generation
- Email validation

---

## 📊 Event ID Format

```
NAME-LOCATION-DDMONYYYY

Example: TECHFEST-BLR-15NOV2026

Why this format?
- Same event on same date, different locations = different IDs ✓
- Day-specific avoids collisions ✓
- Human-readable ✓
- Self-documenting ✓
```

---

## 🔐 Security Principles

```
1. RLS at database level
   ↓
2. Organizer A never sees Organizer B's data
   ↓
3. Service key server-only
   ↓
4. Anon key RLS-restricted
   ↓
5. HTTPS everywhere
```

---

## 📱 PWA Support

App is installable on phones:
- Android: Click "+" → "Install app"
- iPhone: Share → "Add to Home Screen"

Uses manifest.json + service worker (public/)

---

## 🔄 Git Workflow

```bash
# After making changes
git add .
git commit -m "Step 2: Description"
git push

# See history
git log --oneline
```

---

## 📈 Project Progress

| Step | Feature | Status |
|------|---------|--------|
| 1 | Login, events, create event | ✅ DONE |
| 2 | Guest list import | ⏳ NEXT |
| 3 | Check-in screen | ⏳ Coming |
| 4 | Live dashboard | ⏳ Coming |
| 5 | Badge printing | ⏳ Coming |
| 6 | Export reports | ⏳ Coming |

---

## 🎯 Key Stats

- **Tech Stack:** Next.js, TypeScript, Supabase, Tailwind
- **Database:** PostgreSQL with RLS
- **Auth:** Supabase Auth (email/password)
- **Hosting:** Vercel (recommended)
- **Testing:** Jest
- **Setup Time:** 5 minutes
- **Test Time:** 5 minutes
- **Deploy Time:** 5 minutes

---

## 💬 Common Questions

**Q: Can I use this in production?**  
A: Yes. Step 1 is production-ready.

**Q: Do I need to pay?**  
A: No. Supabase free tier + Vercel free tier = $0.

**Q: Can I modify the code?**  
A: Yes. It's all yours.

**Q: What about Step 2?**  
A: Ask me once Step 1 is working!

---

## 🆘 Help

- **Docs:** README.md (full) or QUICK_START.md (quick)
- **Errors:** Check README.md troubleshooting
- **Architecture:** DECISIONS_MADE.md
- **Setup:** ENV_VARIABLES.md
- **Testing:** STEP1_SUMMARY.md

---

**Next Step:** Read QUICK_START.md (2 minutes) and get running! 🚀
