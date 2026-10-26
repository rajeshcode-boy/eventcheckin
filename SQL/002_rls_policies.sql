-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_prints ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Helpers: the current user's org and admin status.
-- SECURITY DEFINER so they read profiles without re-entering its RLS policies
-- (a policy on profiles that selects from profiles recurses infinitely).
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- Organizations: Users can only see their own org
-- (orgs are created by the handle_new_user signup trigger, not by clients)
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = current_org_id());

-- Profiles: Users can view and edit their own profile, admins can manage staff
CREATE POLICY "Users can view their org's profiles"
  ON profiles FOR SELECT
  USING (organization_id = current_org_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id = current_org_id());

CREATE POLICY "Admins can create staff profiles in their org"
  ON profiles FOR INSERT
  WITH CHECK (is_org_admin() AND organization_id = current_org_id());

CREATE POLICY "Admins can update staff profiles in their org"
  ON profiles FOR UPDATE
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Events: Users see only their org's events
CREATE POLICY "Users can view their org's events"
  ON events FOR SELECT
  USING (organization_id = current_org_id());

CREATE POLICY "Admins can create events"
  ON events FOR INSERT
  WITH CHECK (is_org_admin() AND organization_id = current_org_id());

CREATE POLICY "Admins can update events in their org"
  ON events FOR UPDATE
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Registrations: Users see only their org's event registrations
CREATE POLICY "Users can view registrations for their org's events"
  ON registrations FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

CREATE POLICY "Staff can create registrations for their org's events"
  ON registrations FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

CREATE POLICY "Staff can update registrations for their org's events"
  ON registrations FOR UPDATE
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

-- Checkins: Users can view checkins for their org's events
CREATE POLICY "Users can view checkins for their org's events"
  ON checkins FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

CREATE POLICY "Staff can create checkins for their org's events"
  ON checkins FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

-- Badge prints: Users can view and create badge prints for their org's events
CREATE POLICY "Users can view badge prints for their org's events"
  ON badge_prints FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

CREATE POLICY "Staff can create badge prints for their org's events"
  ON badge_prints FOR INSERT
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

-- Import jobs: Users see only their org's imports
CREATE POLICY "Users can view import jobs for their org's events"
  ON import_jobs FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

CREATE POLICY "Admins can create import jobs in their org"
  ON import_jobs FOR INSERT
  WITH CHECK (
    is_org_admin()
    AND event_id IN (SELECT id FROM events WHERE organization_id = current_org_id())
  );

-- Admin actions: Users see only their org's audit log
CREATE POLICY "Users can view audit log for their org's actions"
  ON admin_actions FOR SELECT
  USING (actor_id IN (SELECT id FROM profiles WHERE organization_id = current_org_id()));

CREATE POLICY "Any authenticated user can log admin actions"
  ON admin_actions FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- Public check-in function: only allow checking in to a public endpoint
-- This is called from the unauthenticated /checkin/[eventId] page
-- Table aliases keep column names from clashing with the OUT parameters.
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

  -- Find registration by event and (email or phone)
  SELECT r.id INTO v_registration_id
  FROM registrations r
  WHERE r.event_id = v_event_uuid
    AND (
      (r.email IS NOT NULL AND LOWER(TRIM(r.email)) = LOWER(TRIM(p_email)))
      OR (r.phone IS NOT NULL AND TRIM(r.phone) = TRIM(p_phone))
    )
  LIMIT 1;

  -- If registration not found, return failure
  IF v_registration_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT, false, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Check if already checked in
  SELECT COUNT(*), MAX(c.checked_in_at)
  INTO v_checkin_count, v_earlier_checkin
  FROM checkins c
  WHERE c.registration_id = v_registration_id;

  -- If already checked in, return warning
  IF v_checkin_count > 0 THEN
    RETURN QUERY
    SELECT true, r.registration_id, r.full_name, r.company, true, v_earlier_checkin
    FROM registrations r WHERE r.id = v_registration_id;
    RETURN;
  END IF;

  -- Record the check-in
  INSERT INTO checkins (registration_id, event_id, method, checked_in_by)
  VALUES (v_registration_id, v_event_uuid, 'qr', 'guest');

  -- Return success
  RETURN QUERY
  SELECT true, r.registration_id, r.full_name, r.company, false, NULL::TIMESTAMP WITH TIME ZONE
  FROM registrations r WHERE r.id = v_registration_id;
END;
$$;

-- Grant execute permission on public check-in function to anon (unauthenticated users)
GRANT EXECUTE ON FUNCTION public_check_in_guest TO anon;
