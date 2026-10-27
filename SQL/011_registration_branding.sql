-- Step 11: registration page shows the event's branding (banner, logo, place)

DROP FUNCTION IF EXISTS public_registration_info(TEXT);
CREATE FUNCTION public_registration_info(p_token TEXT)
RETURNS TABLE (
  name TEXT, location TEXT, city TEXT, country TEXT, event_date DATE,
  registration_open BOOLEAN, is_full BOOLEAN, approval_mode TEXT,
  banner_path TEXT, logo_path TEXT, org_logo_path TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.name, e.location, e.city, e.country, e.event_date, e.registration_open,
    (e.registration_capacity IS NOT NULL AND (
      SELECT COUNT(*) FROM registrations r
      WHERE r.event_id = e.id AND r.registration_status NOT IN ('cancelled', 'rejected')
    ) >= e.registration_capacity) AS is_full,
    e.approval_mode,
    e.banner_path, e.logo_path, o.logo_path
  FROM events e
  JOIN organizations o ON o.id = e.organization_id
  WHERE e.registration_token = p_token
$$;

REVOKE EXECUTE ON FUNCTION public_registration_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_registration_info(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
