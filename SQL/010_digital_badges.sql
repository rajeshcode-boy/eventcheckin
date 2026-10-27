-- Step 10: digital badge after check-in, and collection at the registration desk

-- Unguessable token for the public badge link (the QR stays the registration ID for staff)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS badge_token TEXT
  DEFAULT REPLACE(gen_random_uuid()::TEXT, '-', '');
UPDATE registrations SET badge_token = REPLACE(gen_random_uuid()::TEXT, '-', '') WHERE badge_token IS NULL;
ALTER TABLE registrations ALTER COLUMN badge_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_badge_token ON registrations(badge_token);

-- Desk collection: when the printed badge was handed over, and by whom
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS badge_collected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS badge_collected_by TEXT;

-- Check-in result now includes the badge token so the guest's badge can be shown
DROP FUNCTION IF EXISTS public_check_in_guest(TEXT, TEXT);
CREATE FUNCTION public_check_in_guest(p_event_id TEXT, p_query TEXT)
RETURNS TABLE (
  status TEXT,                -- 'checked_in' | 'already_checked_in' | 'not_found' | 'event_not_found' | 'closed'
  registration_id TEXT,
  full_name TEXT,
  designation TEXT,
  company TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  badge_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_uuid UUID;
  v_query TEXT := LOWER(TRIM(COALESCE(p_query, '')));
  v_digits TEXT := LTRIM(REGEXP_REPLACE(COALESCE(p_query, ''), '\D', '', 'g'), '0');
  v_reg registrations%ROWTYPE;
  v_first_checkin TIMESTAMP WITH TIME ZONE;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT e.id INTO v_event_uuid FROM events e WHERE e.event_id = p_event_id;
  IF v_event_uuid IS NULL THEN
    RETURN QUERY SELECT 'event_not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM events e WHERE e.id = v_event_uuid AND e.status = 'closed') THEN
    RETURN QUERY SELECT 'closed'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  IF POSITION('@' IN v_query) > 0 THEN
    SELECT r.* INTO v_reg FROM registrations r
    WHERE r.event_id = v_event_uuid
      AND (LOWER(TRIM(r.email)) = v_query OR LOWER(TRIM(r.company_email)) = v_query)
    LIMIT 1;
  ELSIF LENGTH(v_digits) >= 7 THEN
    SELECT r.* INTO v_reg FROM registrations r
    WHERE r.event_id = v_event_uuid
      AND r.phone IS NOT NULL
      AND (
        LTRIM(REGEXP_REPLACE(r.phone, '\D', '', 'g'), '0') = v_digits
        OR LTRIM(REGEXP_REPLACE(r.phone, '\D', '', 'g'), '0') LIKE '%' || v_digits
      )
    ORDER BY r.created_at
    LIMIT 1;
  END IF;

  IF v_reg.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  SELECT MIN(c.checked_in_at) INTO v_first_checkin FROM checkins c WHERE c.registration_id = v_reg.id;
  IF v_first_checkin IS NOT NULL THEN
    RETURN QUERY SELECT 'already_checked_in'::TEXT, v_reg.registration_id, v_reg.full_name, v_reg.designation,
      v_reg.company, v_first_checkin, v_reg.badge_token;
    RETURN;
  END IF;

  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_reg.id, v_event_uuid, 'qr', 'guest')
  RETURNING checkins.checked_in_at INTO v_now;

  RETURN QUERY SELECT 'checked_in'::TEXT, v_reg.registration_id, v_reg.full_name, v_reg.designation,
    v_reg.company, v_now, v_reg.badge_token;
END;
$$;

-- Public badge page: the attendee's details, check-in and collection status, and the event's default badge design.
-- Looked up by the unguessable badge token, never by the short registration ID.
DROP FUNCTION IF EXISTS public_badge(TEXT);
CREATE FUNCTION public_badge(p_token TEXT)
RETURNS TABLE (
  status TEXT,                  -- 'ok' | 'not_found'
  registration_id TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  designation TEXT,
  company TEXT,
  country TEXT,
  city TEXT,
  industry TEXT,
  registration_status TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  collected_at TIMESTAMP WITH TIME ZONE,
  event_name TEXT,
  event_location TEXT,
  event_date DATE,
  event_country TEXT,
  event_city TEXT,
  event_logo_path TEXT,
  org_logo_path TEXT,
  design JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'ok'::TEXT,
    r.registration_id, r.first_name, r.last_name, r.full_name, r.designation, r.company,
    r.country, r.city, r.industry, r.registration_status,
    (SELECT MIN(c.checked_in_at) FROM checkins c WHERE c.registration_id = r.id),
    r.badge_collected_at,
    e.name, e.location, e.event_date, e.country, e.city,
    e.logo_path, o.logo_path,
    (SELECT bd.design FROM badge_designs bd WHERE bd.event_id = e.id AND bd.is_default LIMIT 1)
  FROM registrations r
  JOIN events e ON e.id = r.event_id
  JOIN organizations o ON o.id = e.organization_id
  WHERE r.badge_token = p_token
$$;

REVOKE EXECUTE ON FUNCTION public_check_in_guest(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public_badge(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_check_in_guest(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_badge(TEXT) TO anon, authenticated;

-- Refresh the API's cached schema so the changes apply immediately
NOTIFY pgrst, 'reload schema';
