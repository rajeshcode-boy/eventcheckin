# Quick Start Guide - EventCheckin Step 1

## 2-Minute Setup

### 1. Get Supabase Credentials
1. Go to https://supabase.com → Sign up/login
2. Create new project
3. Wait 2 minutes for database
4. Go to Settings → API
5. Copy these values:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role secret → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Setup Project
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local and paste your Supabase values
# Add: NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# Add: NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
# Add: SUPABASE_SERVICE_ROLE_KEY=your_key_here

# Install dependencies
npm install
```

### 3. Run Migrations
1. Open your Supabase project
2. Go to SQL Editor → New Query
3. Copy-paste entire contents of `SQL/001_init_schema.sql`
4. Click ▶️ Run
5. Create another query with `SQL/002_rls_policies.sql`
6. Click ▶️ Run

### 4. Start Development Server
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Test in 3 Steps

1. **Sign up:** Click "Sign Up", enter email, password, organization name
2. **Create event:** After login, click "Create Event"
   - Name: Tech Fest
   - Location: Bengaluru
   - Date: Nov 15, 2026
   - Click "Generate ID" → See `TECHFEST-BLR-15NOV2026`
   - Click "Create Event"
3. **Verify RLS:** Log out, sign up as different email, see no events

✅ Done!

---

## Deploy to Vercel (Optional)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your/repo
git push -u origin main

# 2. Go to vercel.com → Import project
# 3. Add same env vars from .env.local
# 4. Deploy
```

Your app will be live at `https://yourname.vercel.app`

---

## Common Issues

**"Missing Supabase environment variables"**
→ Check `.env.local` has all three keys, restart `npm run dev`

**"Database connection error"**
→ Verify URL is correct, check migrations ran in Supabase SQL Editor

**"Sign up not working"**
→ Check Supabase Auth is enabled (Settings → Auth)

**"RLS error when creating event"**
→ Make sure both SQL migrations ran successfully

---

## What's Next?

After this works, you'll build:
- **Step 2:** Import guest lists from CSV/Excel
- **Step 3:** Check-in screen for attendees
- **Step 4:** Live dashboard
- **Step 5:** Badge printing
- **Step 6:** Export reports

See `STEP1_SUMMARY.md` for details.
