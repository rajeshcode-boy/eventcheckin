-- Step 22: the registration confirmation page can show the guest's digital pass link.
-- public_register_online now also returns badge_token, but only for a new registration that does not
-- need approval. 'pending', 'already_registered', 'full', 'closed' and 'invalid' return NULL, so the
-- function cannot be used to look up someone else's pass by email.
-- The return type changes, so the function is dropped and created again.

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
RETURNS TABLE (status TEXT, registration_id TEXT, badge_token TEXT)
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
  v_token TEXT;
BEGIN
  SELECT * INTO v_event FROM events e WHERE e.registration_token = p_token;
  IF v_event.id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TEXT; RETURN;
  END IF;
  IF NOT v_event.registration_open THEN
    RETURN QUERY SELECT 'closed'::TEXT, NULL::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF v_first IS NULL OR NULLIF(TRIM(p_designation), '') IS NULL OR NULLIF(TRIM(p_company), '') IS NULL
     OR v_email IS NULL OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' OR NOT COALESCE(p_consent, FALSE)
     OR LENGTH(COALESCE(v_first, '') || COALESCE(v_last, '') || COALESCE(p_designation, '') || COALESCE(p_company, '') || v_email) > 600 THEN
    RETURN QUERY SELECT 'invalid'::TEXT, NULL::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM registrations r
    WHERE r.event_id = v_event.id AND (LOWER(r.email) = v_email OR LOWER(r.company_email) = v_email)
  ) THEN
    RETURN QUERY SELECT 'already_registered'::TEXT, NULL::TEXT, NULL::TEXT; RETURN;
  END IF;

  IF v_event.registration_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count FROM registrations r
    WHERE r.event_id = v_event.id AND r.registration_status NOT IN ('cancelled', 'rejected');
    IF v_count >= v_event.registration_capacity THEN
      RETURN QUERY SELECT 'full'::TEXT, NULL::TEXT, NULL::TEXT; RETURN;
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
  ) RETURNING registrations.badge_token INTO v_token;

  RETURN QUERY SELECT
    CASE WHEN v_event.approval_mode = 'manual' THEN 'pending' ELSE 'registered' END::TEXT,
    v_reg_code,
    -- Only a brand-new, approved registration gets its pass token back. Pending ones are not approved yet,
    -- and 'already_registered' above returns nothing, so an email address cannot be used to fetch a pass.
    CASE WHEN v_event.approval_mode = 'manual' THEN NULL ELSE v_token END::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public_register_online(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_register_online(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
