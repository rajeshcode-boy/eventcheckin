-- Attendee form: separate first/last name, corporate vs personal email.
-- `email` holds the personal address, `company_email` the corporate one.
-- full_name stays filled (first + last) for search, duplicates and badges.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS last_name TEXT;

-- One registration per corporate email per event, like personal email
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_company_email
  ON registrations(event_id, lower(company_email)) WHERE company_email IS NOT NULL;

-- Public check-in matches either email
CREATE OR REPLACE FUNCTION public_check_in_guest(
  p_event_id TEXT,
  p_email TEXT,
  p_phone TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  registration_id TEXT,
  full_name TEXT,
  company TEXT,
  already_checked_in BOOLEAN,
  earlier_checkin_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_uuid UUID;
  v_registration_id UUID;
  v_checkin_count INT;
  v_earlier_checkin TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT e.id INTO v_event_uuid FROM events e WHERE e.event_id = p_event_id;

  SELECT r.id INTO v_registration_id
  FROM registrations r
  WHERE r.event_id = v_event_uuid
    AND (
      (r.email IS NOT NULL AND LOWER(TRIM(r.email)) = LOWER(TRIM(p_email)))
      OR (r.company_email IS NOT NULL AND LOWER(TRIM(r.company_email)) = LOWER(TRIM(p_email)))
      OR (r.phone IS NOT NULL AND TRIM(r.phone) = TRIM(p_phone))
    )
  LIMIT 1;

  IF v_registration_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT, false, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  SELECT COUNT(*), MAX(c.checked_in_at)
  INTO v_checkin_count, v_earlier_checkin
  FROM checkins c
  WHERE c.registration_id = v_registration_id;

  IF v_checkin_count > 0 THEN
    RETURN QUERY
    SELECT true, r.registration_id, r.full_name, r.company, true, v_earlier_checkin
    FROM registrations r WHERE r.id = v_registration_id;
    RETURN;
  END IF;

  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_registration_id, v_event_uuid, 'qr', 'guest');

  RETURN QUERY
  SELECT true, r.registration_id, r.full_name, r.company, false, NULL::TIMESTAMP WITH TIME ZONE
  FROM registrations r WHERE r.id = v_registration_id;
END;
$$;
