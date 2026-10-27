-- Step 9: public registration links, approval mode, team referral codes and source tracking

-- Each event gets a random registration token. Changing it (or closing registration) disables the old link.
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_token TEXT
  DEFAULT REPLACE(gen_random_uuid()::TEXT, '-', '');
UPDATE events SET registration_token = REPLACE(gen_random_uuid()::TEXT, '-', '') WHERE registration_token IS NULL;
ALTER TABLE events ALTER COLUMN registration_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_registration_token ON events(registration_token);

ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_capacity INTEGER CHECK (registration_capacity IS NULL OR registration_capacity > 0);
ALTER TABLE events ADD COLUMN IF NOT EXISTS approval_mode TEXT NOT NULL DEFAULT 'auto'
  CHECK (approval_mode IN ('auto', 'manual'));

-- Team members who share the registration link. Each has a code that is saved on the registrations they bring in.
CREATE TABLE IF NOT EXISTS event_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name <> ''),
  referral_code TEXT NOT NULL CHECK (referral_code ~ '^[A-Z0-9]{6}$'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, referral_code)
);
CREATE INDEX IF NOT EXISTS idx_team_members_event ON event_team_members(event_id);

ALTER TABLE event_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's team members" ON event_team_members;
CREATE POLICY "Users can view their org's team members"
  ON event_team_members FOR SELECT
  USING (organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can manage team members in their org" ON event_team_members;
CREATE POLICY "Admins can manage team members in their org"
  ON event_team_members FOR ALL
  USING (organization_id = current_org_id() AND is_org_admin())
  WITH CHECK (organization_id = current_org_id() AND is_org_admin());

-- Registrations: who brought them in, through which channel, and when consent was given
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS referral_member_id UUID REFERENCES event_team_members(id) ON DELETE SET NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS link_source TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP WITH TIME ZONE;

-- Allow registrations made through the public link
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_source_check;
ALTER TABLE registrations ADD CONSTRAINT registrations_source_check
  CHECK (source IN ('import', 'manual', 'walkin', 'online'));

CREATE INDEX IF NOT EXISTS idx_registrations_referral ON registrations(event_id, referral_member_id);

-- Public registration page: event details and whether it is open to new registrations
CREATE OR REPLACE FUNCTION public_registration_info(p_token TEXT)
RETURNS TABLE (
  name TEXT, location TEXT, event_date DATE, registration_open BOOLEAN, is_full BOOLEAN, approval_mode TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.name, e.location, e.event_date, e.registration_open,
    (e.registration_capacity IS NOT NULL AND (
      SELECT COUNT(*) FROM registrations r
      WHERE r.event_id = e.id AND r.registration_status NOT IN ('cancelled', 'rejected')
    ) >= e.registration_capacity) AS is_full,
    e.approval_mode
  FROM events e
  WHERE e.registration_token = p_token
$$;

-- Self-registration from the public link.
-- Returns status: 'registered' | 'pending' | 'already_registered' | 'closed' | 'full' | 'invalid' | 'not_found'
DROP FUNCTION IF EXISTS public_register_online(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
CREATE FUNCTION public_register_online(
  p_token TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_designation TEXT,
  p_company TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_ref TEXT,
  p_src TEXT,
  p_consent BOOLEAN
)
RETURNS TABLE (status TEXT, registration_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events%ROWTYPE;
  v_first TEXT := NULLIF(TRIM(p_first_name), '');
  v_last TEXT := NULLIF(TRIM(p_last_name), '');
  v_email TEXT := NULLIF(LOWER(TRIM(p_email)), '');
  v_phone TEXT := NULLIF(TRIM(p_phone), '');
  v_ref TEXT := NULLIF(UPPER(TRIM(p_ref)), '');
  v_src TEXT := LEFT(COALESCE(NULLIF(LOWER(TRIM(p_src)), ''), 'link'), 30);
  v_member UUID;
  v_full TEXT;
  v_reg_code TEXT;
  v_personal BOOLEAN;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_event FROM events e WHERE e.registration_token = p_token;
  IF v_event.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT; RETURN;
  END IF;
  IF NOT v_event.registration_open THEN
    RETURN QUERY SELECT 'closed'::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF v_first IS NULL OR NULLIF(TRIM(p_designation), '') IS NULL OR NULLIF(TRIM(p_company), '') IS NULL
     OR v_email IS NULL OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR NOT COALESCE(p_consent, FALSE)
     OR LENGTH(COALESCE(v_first, '') || COALESCE(v_last, '') || COALESCE(p_designation, '') || COALESCE(p_company, '') || v_email) > 600 THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.event_id = v_event.id AND (LOWER(r.email) = v_email OR LOWER(r.company_email) = v_email)
  ) THEN
    RETURN QUERY SELECT 'already_registered'::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF v_event.registration_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM registrations r
    WHERE r.event_id = v_event.id AND r.registration_status NOT IN ('cancelled', 'rejected');
    IF v_count >= v_event.registration_capacity THEN
      RETURN QUERY SELECT 'full'::TEXT, NULL::TEXT; RETURN;
    END IF;
  END IF;

  -- Credit the team member whose code was used; an unknown code is ignored, not an error
  IF v_ref IS NOT NULL THEN
    SELECT t.id INTO v_member FROM event_team_members t
    WHERE t.event_id = v_event.id AND t.referral_code = v_ref;
  END IF;

  v_full := TRIM(v_first || ' ' || COALESCE(v_last, ''));
  v_personal := SPLIT_PART(v_email, '@', 2) IN (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'outlook.com',
    'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.in', 'msn.com', 'icloud.com', 'me.com',
    'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'gmx.com', 'mail.com', 'yandex.com',
    'rediffmail.com', 'qq.com'
  );

  LOOP
    v_reg_code := (
      SELECT STRING_AGG(SUBSTR('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', (FLOOR(RANDOM() * 36) + 1)::INT, 1), '')
      FROM GENERATE_SERIES(1, 6)
    );
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM registrations r WHERE r.event_id = v_event.id AND r.registration_id = v_reg_code
    );
  END LOOP;

  INSERT INTO registrations (
    event_id, registration_id, source, first_name, last_name, full_name, designation, company,
    email, company_email, phone, registration_status,
    referral_member_id, referral_code, link_source, consent_at
  ) VALUES (
    v_event.id, v_reg_code, 'online', v_first, v_last, v_full, TRIM(p_designation), TRIM(p_company),
    CASE WHEN v_personal THEN v_email END,
    CASE WHEN NOT v_personal THEN v_email END,
    v_phone,
    CASE WHEN v_event.approval_mode = 'manual' THEN 'pending' ELSE 'registered' END,
    v_member,
    CASE WHEN v_member IS NOT NULL THEN v_ref END,
    v_src,
    NOW()
  );

  RETURN QUERY SELECT
    CASE WHEN v_event.approval_mode = 'manual' THEN 'pending' ELSE 'registered' END::TEXT,
    v_reg_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public_registration_info(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public_register_online(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_registration_info(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_register_online(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

-- Refresh the API's cached schema so the changes apply immediately
NOTIFY pgrst, 'reload schema';
