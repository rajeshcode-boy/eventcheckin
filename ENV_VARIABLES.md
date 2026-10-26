# Environment Variables Reference

## Required Variables

All variables go in `.env.local` (created from `.env.example`).

### Supabase Configuration

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Purpose:** Your Supabase project's API endpoint
- **Required:** Yes
- **Public:** Yes (safe to expose in browser)
- **Example:** `https://abc123def456.supabase.co`
- **Where to find:**
  1. Open your Supabase project
  2. Go to Settings → API
  3. Copy "Project URL"

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose:** Anonymous key for unauthenticated API access (RLS restricts what users see)
- **Required:** Yes
- **Public:** Yes (safe to expose in browser)
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:**
  1. Open your Supabase project
  2. Go to Settings → API
  3. Copy "anon public" key

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose:** Admin key for server-side operations (never expose to browser)
- **Required:** Yes
- **Public:** NO - server-only
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find:**
  1. Open your Supabase project
  2. Go to Settings → API
  3. Copy "service_role" secret key
- **⚠️ IMPORTANT:** Keep this safe, never commit to Git, never expose in browser

### App Configuration

#### `NEXT_PUBLIC_APP_URL`
- **Purpose:** Your app's public URL (used for QR codes, redirects, check-in links)
- **Required:** Yes
- **Public:** Yes
- **Default for local:** `http://localhost:3000`
- **For production:** `https://yourapp.vercel.app` or your custom domain
- **Note:** Must match your deployment URL

### Database (Optional for Step 1)

#### `DATABASE_URL`
- **Purpose:** Direct PostgreSQL connection string (for migrations via CLI)
- **Required:** No (use Supabase SQL Editor instead)
- **Public:** NO
- **Format:** `postgresql://user:password@host:port/dbname`
- **Where to find:** Supabase → Settings → Database → Connection pooling

---

## How to Fill `.env.local`

1. Copy the template:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` in your editor

3. Fill in each variable:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Save and restart `npm run dev`

---

## Security Checklist

- [ ] `.env.local` is in `.gitignore` (won't commit accidentally)
- [ ] Service role key is only in `.env.local`, never in code
- [ ] Anon key is public (it's restricted by RLS in database)
- [ ] `.env.local` is never shared or committed to Git
- [ ] On Vercel, env vars are set in project settings (not in code)

---

## For Deployment (Vercel, etc.)

1. Do NOT commit `.env.local`
2. On your hosting platform (Vercel):
   - Go to project Settings → Environment Variables
   - Add all 4 variables
   - Don't include `NEXT_PUBLIC_` prefix (it's auto-added by Next.js)
   - Redeploy

---

## Troubleshooting

**"Missing Supabase environment variables"**
- Solution: Check `.env.local` exists and has all 3 Supabase keys
- Restart: `npm run dev`

**"PostgreSQL connection failed"**
- Likely cause: Wrong URL or anon key
- Check: Copy-paste from Supabase Settings → API again (no extra spaces)

**"Service role error"**
- Likely cause: Using wrong key for server operations
- Check: Service role key should be long (300+ chars)

**"RLS error when creating event"**
- Likely cause: Migrations didn't run
- Fix: Re-run both SQL files in Supabase SQL Editor

---

## Which Variables Are Used Where?

| Variable | Frontend | Backend | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Connect to Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Auth & RLS access |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ | Server-only admin ops |
| `NEXT_PUBLIC_APP_URL` | ✅ | ✅ | Build URLs (QR codes, redirects) |
| `DATABASE_URL` | ❌ | ✅ | Direct DB (optional) |

✅ = Used
❌ = Never used (stays on server)

