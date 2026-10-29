-- Step 23: a walk-in who registers on the self check-in page gets their digital pass.
-- public_register_walkin now also returns badge_token, but only for the registration it has just
-- created. 'already_registered', 'invalid', 'closed' and 'event_not_found' return NULL, so it cannot be
-- used to fetch an existing guest's pass. The return type changes, so the function is recreated.

DROP FUNCTION IF EXISTS public_register_walkin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public_register_walkin(
  p_event_id TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_designation TEXT,
  p_company TEXT,
  p_email TEXT
)
RETURNS TABLE (
  status TEXT,                -- 'checked_in' | 'already_registered' | 'event_not_found' | 'invalid' | 'closed'
  registration_id TEXT,
  full_name TEXT,
  designation TEXT,
  company TEXT,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  badge_token TEXT            -- the new walk-in's pass token; NULL for every other status
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
  v_token TEXT;
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

  IF v_first IS NULL OR NULLIF(TRIM(p_designation), '') IS NULL OR NULLIF(TRIM(p_company), '') IS NULL
     OR (v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
     OR LENGTH(COALESCE(v_first, '') || COALESCE(v_last, '') || COALESCE(p_designation, '') || COALESCE(p_company, '') || COALESCE(v_email, '')) > 600 THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.event_id = v_event_uuid AND (LOWER(r.email) = v_email OR LOWER(r.company_email) = v_email)
  ) THEN
    RETURN QUERY SELECT 'already_registered'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
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
  RETURNING registrations.id, registrations.badge_token INTO v_reg_uuid, v_token;

  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_reg_uuid, v_event_uuid, 'walkin', 'walkin')
  RETURNING checkins.checked_in_at INTO v_now;

  RETURN QUERY SELECT 'checked_in'::TEXT, v_reg_code, v_full, TRIM(p_designation), TRIM(p_company), v_now, v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public_register_walkin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_register_walkin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
