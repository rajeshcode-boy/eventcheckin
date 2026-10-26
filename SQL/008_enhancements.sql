-- Enhancements: event location, attendee fields, branding, badge designs, profiles.
-- Additive only: existing rows keep their data (new columns are nullable or defaulted).

-- ---------------------------------------------------------------------------
-- Events: structured location + branding
-- country is an ISO 3166-1 alpha-2 code; `location` stays as the display text
-- ("Bengaluru, India") for older pages and existing events.
-- Image columns hold Storage object paths in the `branding` bucket.
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');
ALTER TABLE events ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_path TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS logo_path TEXT;
CREATE INDEX IF NOT EXISTS idx_events_country_city ON events(country, city);

-- ---------------------------------------------------------------------------
-- Organizations: company logo; admins may edit their own organization
-- ---------------------------------------------------------------------------
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_path TEXT;

DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (id = current_org_id() AND is_org_admin())
  WITH CHECK (id = current_org_id());

-- ---------------------------------------------------------------------------
-- Registrations: attendee location, industry, registration status, attendance
-- confirmation (separate from check-ins, which stay in the checkins table)
-- ---------------------------------------------------------------------------
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS country TEXT CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'registered'
  CHECK (registration_status IN ('registered', 'pending', 'approved', 'rejected', 'cancelled'));
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attendance_confirmation TEXT NOT NULL DEFAULT 'not_confirmed'
  CHECK (attendance_confirmation IN ('confirmed', 'not_confirmed', 'maybe'));

CREATE INDEX IF NOT EXISTS idx_registrations_event_country ON registrations(event_id, country, city);
CREATE INDEX IF NOT EXISTS idx_registrations_event_industry ON registrations(event_id, industry);
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON registrations(event_id, registration_status, attendance_confirmation);
CREATE INDEX IF NOT EXISTS idx_registrations_event_created ON registrations(event_id, created_at);

-- ---------------------------------------------------------------------------
-- Profiles: users edit their own name, phone, designation and photo
-- (profile_photo_url holds an `avatars` bucket path), never their role,
-- organization or email (email belongs to Supabase Auth).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.id = auth.uid() AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'You cannot change your own role, organization or email here';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_fields ON profiles;
CREATE TRIGGER profiles_protect_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Badge designs: one or more templates per event; the default one is printed.
-- `design` is JSON (size, background, border, positioned elements); see lib/badgeDesign.ts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badge_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) BETWEEN 1 AND 80),
  is_default BOOLEAN NOT NULL DEFAULT false,
  design JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_badge_designs_event ON badge_designs(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_designs_one_default ON badge_designs(event_id) WHERE is_default;

ALTER TABLE badge_designs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view badge designs for their org's events" ON badge_designs;
CREATE POLICY "Users can view badge designs for their org's events"
  ON badge_designs FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

DROP POLICY IF EXISTS "Admins can create badge designs" ON badge_designs;
CREATE POLICY "Admins can create badge designs"
  ON badge_designs FOR INSERT
  WITH CHECK (is_org_admin() AND event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

DROP POLICY IF EXISTS "Admins can update badge designs" ON badge_designs;
CREATE POLICY "Admins can update badge designs"
  ON badge_designs FOR UPDATE
  USING (is_org_admin() AND event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

DROP POLICY IF EXISTS "Admins can delete badge designs" ON badge_designs;
CREATE POLICY "Admins can delete badge designs"
  ON badge_designs FOR DELETE
  USING (is_org_admin() AND event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

-- ---------------------------------------------------------------------------
-- Storage buckets. Public read (logos and banners appear on the public
-- check-in page); writes restricted by folder:
--   branding/<organization id>/...  admins of that organization
--   avatars/<user id>/...           that user
-- Size and MIME limits are enforced by Storage; the app also checks file
-- contents before upload.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('branding', 'branding', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Org admins upload branding" ON storage.objects;
CREATE POLICY "Org admins upload branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = public.current_org_id()::text AND public.is_org_admin());

DROP POLICY IF EXISTS "Org admins update branding" ON storage.objects;
CREATE POLICY "Org admins update branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = public.current_org_id()::text AND public.is_org_admin());

DROP POLICY IF EXISTS "Org admins delete branding" ON storage.objects;
CREATE POLICY "Org admins delete branding"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = public.current_org_id()::text AND public.is_org_admin());

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Public event header: add branding and structured location
-- (organization logo is the fallback when the event has no logo)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public_event_info(TEXT);
CREATE FUNCTION public_event_info(p_event_id TEXT)
RETURNS TABLE (
  name TEXT, location TEXT, event_date DATE, status TEXT,
  country TEXT, city TEXT, banner_path TEXT, logo_path TEXT, org_logo_path TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.name, e.location, e.event_date, e.status, e.country, e.city, e.banner_path, e.logo_path, o.logo_path
  FROM events e JOIN organizations o ON o.id = e.organization_id
  WHERE e.event_id = p_event_id
$$;
REVOKE EXECUTE ON FUNCTION public_event_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_event_info(TEXT) TO anon, authenticated;

-- Refresh the API's cached schema so the changes apply immediately
NOTIFY pgrst, 'reload schema';
