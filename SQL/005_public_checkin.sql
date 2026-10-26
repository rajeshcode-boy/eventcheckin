-- Step 3: public check-in page (/checkin/[eventId], no login)

-- The public URL uses the event ID text, so it must be unique across all orgs
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_id_unique ON events(event_id);

-- Public event header: name, location, date only
CREATE OR REPLACE FUNCTION public_event_info(p_event_id TEXT)
RETURNS TABLE (name TEXT, location TEXT, event_date DATE, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.name, e.location, e.event_date, e.status FROM events e WHERE e.event_id = p_event_id
$$;

-- Check in by email (personal or corporate) or phone.
-- Phones match on digits, ignoring country code and trunk 0, so
-- "9886658237", "09886658237" and "+91 98866 58237" all match "+91 9886658237".
DROP FUNCTION IF EXISTS public_check_in_guest(TEXT, TEXT, TEXT);
CREATE FUNCTION public_check_in_guest(p_event_id TEXT, p_query TEXT)
RETURNS TABLE (
  status TEXT,                -- 'checked_in' | 'already_checked_in' | 'not_found' | 'event_not_found'
  registration_id TEXT,
  full_name TEXT,
  company TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE
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
    RETURN QUERY SELECT 'event_not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF POSITION('@' IN v_query) > 0 THEN
    SELECT r.* INTO v_reg FROM registrations r
    WHERE r.event_id = v_event_uuid
      AND (LOWER(TRIM(r.email)) = v_query OR LOWER(TRIM(r.company_email)) = v_query)
    LIMIT 1;
  ELSIF LENGTH(v_digits) >= 7 THEN
    -- Stored "+<code> <number>": match the full digits, or the number after the code
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
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT MIN(c.checked_in_at) INTO v_first_checkin FROM checkins c WHERE c.registration_id = v_reg.id;
  IF v_first_checkin IS NOT NULL THEN
    RETURN QUERY SELECT 'already_checked_in'::TEXT, v_reg.registration_id, v_reg.full_name, v_reg.company, v_first_checkin;
    RETURN;
  END IF;

  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_reg.id, v_event_uuid, 'qr', 'guest')
  RETURNING checkins.checked_in_at INTO v_now;

  RETURN QUERY SELECT 'checked_in'::TEXT, v_reg.registration_id, v_reg.full_name, v_reg.company, v_now;
END;
$$;

-- Walk-in: create a registration (source 'walkin') and check it in
CREATE OR REPLACE FUNCTION public_register_walkin(
  p_event_id TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_designation TEXT,
  p_company TEXT,
  p_email TEXT
)
RETURNS TABLE (
  status TEXT,                -- 'checked_in' | 'already_registered' | 'event_not_found' | 'invalid'
  registration_id TEXT,
  full_name TEXT,
  company TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_uuid UUID;
  v_first TEXT := NULLIF(TRIM(p_first_name), '');
  v_last TEXT := NULLIF(TRIM(p_last_name), '');
  v_email TEXT := NULLIF(LOWER(TRIM(p_email)), '');
  v_full TEXT;
  v_reg_code TEXT;
  v_reg_uuid UUID;
  v_now TIMESTAMP WITH TIME ZONE;
  v_personal BOOLEAN;
BEGIN
  SELECT e.id INTO v_event_uuid FROM events e WHERE e.event_id = p_event_id;
  IF v_event_uuid IS NULL THEN
    RETURN QUERY SELECT 'event_not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_first IS NULL OR NULLIF(TRIM(p_designation), '') IS NULL OR NULLIF(TRIM(p_company), '') IS NULL
     OR (v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
     OR LENGTH(COALESCE(v_first, '') || COALESCE(v_last, '') || COALESCE(p_designation, '') || COALESCE(p_company, '') || COALESCE(v_email, '')) > 600 THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.event_id = v_event_uuid AND (LOWER(r.email) = v_email OR LOWER(r.company_email) = v_email)
  ) THEN
    RETURN QUERY SELECT 'already_registered'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_full := TRIM(v_first || ' ' || COALESCE(v_last, ''));
  -- Same personal-provider rule as the organizer's form
  v_personal := SPLIT_PART(COALESCE(v_email, ''), '@', 2) IN (
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
      SELECT 1 FROM registrations r WHERE r.event_id = v_event_uuid AND r.registration_id = v_reg_code
    );
  END LOOP;

  INSERT INTO registrations (
    event_id, registration_id, source, first_name, last_name, full_name, designation, company, email, company_email
  ) VALUES (
    v_event_uuid, v_reg_code, 'walkin', v_first, v_last, v_full, TRIM(p_designation), TRIM(p_company),
    CASE WHEN v_personal THEN v_email END,
    CASE WHEN NOT v_personal THEN v_email END
  )
  RETURNING id INTO v_reg_uuid;

  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_reg_uuid, v_event_uuid, 'walkin', 'walkin')
  RETURNING checkins.checked_in_at INTO v_now;

  RETURN QUERY SELECT 'checked_in'::TEXT, v_reg_code, v_full, TRIM(p_company), v_now;
END;
$$;

-- Only the public page's functions are callable without login
REVOKE EXECUTE ON FUNCTION public_event_info(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public_check_in_guest(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public_register_walkin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_event_info(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_check_in_guest(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public_register_walkin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
