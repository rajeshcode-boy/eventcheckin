-- Step 20: four per-event roles, enforced by Row Level Security.
--
--   owner        full control, including deleting the event and assigning other owners
--   manager      everything except deleting the event (settings, team, kiosks, badges, guests, check-in)
--   acquisition  guest list only: view, add, edit, import
--   staff        gate and front desk: view guests, check in, mark badges collected, live reports;
--                cannot edit guest details or event settings
--
-- A person's role on an event is the higher of:
--   * their organisation role: the org owner (profiles.is_owner) is 'owner' on every event of the org,
--     any other org admin is 'manager' on every event of the org
--   * their row in event_staff_assignments for that event
-- People with neither have NO access to the event. Organisation staff who were never assigned
-- to an event lose the broad access they had before.
--
-- event_staff_assignments is the per-event team table (SQL/018), so the old roles are mapped:
--   coordinator -> manager, registration -> acquisition, check_in / badges / other -> staff

-- ---------------------------------------------------------------- role column

DO $$
DECLARE
  c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'event_staff_assignments'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE event_staff_assignments DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

UPDATE event_staff_assignments SET role = CASE role
  WHEN 'coordinator' THEN 'manager'
  WHEN 'registration' THEN 'acquisition'
  WHEN 'check_in' THEN 'staff'
  WHEN 'badges' THEN 'staff'
  WHEN 'other' THEN 'staff'
  ELSE role
END
WHERE role NOT IN ('owner', 'manager', 'acquisition', 'staff');

ALTER TABLE event_staff_assignments ALTER COLUMN role SET DEFAULT 'staff';
ALTER TABLE event_staff_assignments
  ADD CONSTRAINT event_staff_assignments_role_check CHECK (role IN ('owner', 'manager', 'acquisition', 'staff'));

-- ---------------------------------------------------------------- helper functions
-- SECURITY DEFINER so they can read profiles / events / assignments without re-entering their RLS.
-- They return NULL / false when nobody is signed in, so anon can run them without learning anything.

CREATE OR REPLACE FUNCTION event_role_rank(p_role TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_role WHEN 'owner' THEN 4 WHEN 'manager' THEN 3 WHEN 'acquisition' THEN 2 WHEN 'staff' THEN 1 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION get_user_event_role(p_event_id UUID) RETURNS TEXT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
  v_org UUID;
  v_implicit TEXT;
  v_assigned TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT p.* INTO v_profile FROM profiles p WHERE p.id = auth.uid();
  IF v_profile.id IS NULL THEN RETURN NULL; END IF;

  SELECT e.organization_id INTO v_org FROM events e WHERE e.id = p_event_id;
  IF v_org IS NULL OR v_org <> v_profile.organization_id THEN RETURN NULL; END IF;

  v_implicit := CASE WHEN v_profile.is_owner THEN 'owner' WHEN v_profile.role = 'admin' THEN 'manager' END;
  SELECT a.role INTO v_assigned FROM event_staff_assignments a
  WHERE a.event_id = p_event_id AND a.profile_id = auth.uid();

  RETURN CASE WHEN event_role_rank(v_implicit) >= event_role_rank(v_assigned) THEN v_implicit ELSE v_assigned END;
END;
$$;

CREATE OR REPLACE FUNCTION has_event_role(p_event_id UUID, p_roles TEXT[]) RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(get_user_event_role(p_event_id) = ANY (p_roles), FALSE)
$$;

-- The permission table. Policies ask for a capability, so the role list lives in one place.
CREATE OR REPLACE FUNCTION event_can(p_event_id UUID, p_capability TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE p_capability
      WHEN 'view_event'     THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'acquisition', 'staff')
      WHEN 'view_guests'    THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'acquisition', 'staff')
      WHEN 'edit_guests'    THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'acquisition')
      WHEN 'import_guests'  THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'acquisition')
      WHEN 'delete_guests'  THEN get_user_event_role(p_event_id) IN ('owner', 'manager')
      WHEN 'check_in'       THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'staff')
      WHEN 'view_reports'   THEN get_user_event_role(p_event_id) IN ('owner', 'manager', 'staff')
      WHEN 'edit_event'     THEN get_user_event_role(p_event_id) IN ('owner', 'manager')
      WHEN 'manage_team'    THEN get_user_event_role(p_event_id) IN ('owner', 'manager')
      WHEN 'manage_kiosks'  THEN get_user_event_role(p_event_id) IN ('owner', 'manager')
      WHEN 'manage_badges'  THEN get_user_event_role(p_event_id) IN ('owner', 'manager')
      WHEN 'delete_event'   THEN get_user_event_role(p_event_id) = 'owner'
      ELSE FALSE
    END,
    FALSE)
$$;

REVOKE EXECUTE ON FUNCTION event_role_rank(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_event_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION has_event_role(UUID, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION event_can(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION event_role_rank(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_event_role(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION has_event_role(UUID, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION event_can(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------- events
-- Creating an event is still for organisation admins: there is no event yet to hold a role.

DROP POLICY IF EXISTS "Users can view their org's events" ON events;
-- Written inline, not with event_can(): a function that reads `events` cannot see a row inserted by the
-- same statement, which would break "insert an event and return it". Same rule as view_event: any org
-- admin, or anyone assigned to the event.
CREATE POLICY "Event members can view their events"
  ON events FOR SELECT
  USING (
    organization_id = current_org_id()
    AND (
      is_org_admin()
      OR EXISTS (SELECT 1 FROM event_staff_assignments a WHERE a.event_id = events.id AND a.profile_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update events in their org" ON events;
CREATE POLICY "Owners and managers can update events"
  ON events FOR UPDATE
  USING (event_can(id, 'edit_event'))
  WITH CHECK (organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can delete events in their org" ON events;
CREATE POLICY "Owners can delete events"
  ON events FOR DELETE
  USING (event_can(id, 'delete_event'));

-- ---------------------------------------------------------------- registrations

DROP POLICY IF EXISTS "Users can view registrations for their org's events" ON registrations;
CREATE POLICY "Event members can view registrations"
  ON registrations FOR SELECT
  USING (event_can(event_id, 'view_guests'));

DROP POLICY IF EXISTS "Staff can create registrations for their org's events" ON registrations;
CREATE POLICY "Guest managers can create registrations"
  ON registrations FOR INSERT
  WITH CHECK (event_can(event_id, 'edit_guests'));

-- Onsite staff may update a registration, but the trigger below limits them to the badge-collected fields.
DROP POLICY IF EXISTS "Staff can update registrations for their org's events" ON registrations;
CREATE POLICY "Guest managers and onsite staff can update registrations"
  ON registrations FOR UPDATE
  USING (event_can(event_id, 'edit_guests') OR event_can(event_id, 'check_in'))
  WITH CHECK (event_can(event_id, 'edit_guests') OR event_can(event_id, 'check_in'));

DROP POLICY IF EXISTS "Admins can delete registrations for their org's events" ON registrations;
CREATE POLICY "Owners and managers can delete registrations"
  ON registrations FOR DELETE
  USING (event_can(event_id, 'delete_guests'));

CREATE OR REPLACE FUNCTION guard_registration_update() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side functions (no signed-in user) are unaffected
  IF auth.uid() IS NULL OR event_can(NEW.event_id, 'edit_guests') THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'badge_collected_at' - 'badge_collected_by' - 'updated_at')
     IS DISTINCT FROM (to_jsonb(OLD) - 'badge_collected_at' - 'badge_collected_by' - 'updated_at') THEN
    RAISE EXCEPTION 'Your role can only mark badges as collected' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_registration_update ON registrations;
CREATE TRIGGER trg_guard_registration_update
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION guard_registration_update();

-- ---------------------------------------------------------------- checkins, badge prints, imports

DROP POLICY IF EXISTS "Users can view checkins for their org's events" ON checkins;
CREATE POLICY "Event members can view checkins"
  ON checkins FOR SELECT
  USING (event_can(event_id, 'view_guests'));

DROP POLICY IF EXISTS "Staff can create checkins for their org's events" ON checkins;
CREATE POLICY "Gate staff can create checkins"
  ON checkins FOR INSERT
  WITH CHECK (event_can(event_id, 'check_in'));

DROP POLICY IF EXISTS "Users can view badge prints for their org's events" ON badge_prints;
CREATE POLICY "Event members can view badge prints"
  ON badge_prints FOR SELECT
  USING (event_can(event_id, 'view_event'));

DROP POLICY IF EXISTS "Staff can create badge prints for their org's events" ON badge_prints;
CREATE POLICY "Gate staff can create badge prints"
  ON badge_prints FOR INSERT
  WITH CHECK (event_can(event_id, 'check_in'));

DROP POLICY IF EXISTS "Users can view import jobs for their org's events" ON import_jobs;
CREATE POLICY "Guest managers can view import jobs"
  ON import_jobs FOR SELECT
  USING (event_can(event_id, 'import_guests'));

DROP POLICY IF EXISTS "Admins can create import jobs in their org" ON import_jobs;
CREATE POLICY "Guest managers can create import jobs"
  ON import_jobs FOR INSERT
  WITH CHECK (event_can(event_id, 'import_guests'));

-- ---------------------------------------------------------------- badge designs

DROP POLICY IF EXISTS "Users can view badge designs for their org's events" ON badge_designs;
CREATE POLICY "Event members can view badge designs"
  ON badge_designs FOR SELECT
  USING (event_can(event_id, 'view_event'));

DROP POLICY IF EXISTS "Admins can create badge designs" ON badge_designs;
CREATE POLICY "Owners and managers can create badge designs"
  ON badge_designs FOR INSERT
  WITH CHECK (event_can(event_id, 'manage_badges'));

DROP POLICY IF EXISTS "Admins can update badge designs" ON badge_designs;
CREATE POLICY "Owners and managers can update badge designs"
  ON badge_designs FOR UPDATE
  USING (event_can(event_id, 'manage_badges'))
  WITH CHECK (event_can(event_id, 'manage_badges'));

DROP POLICY IF EXISTS "Admins can delete badge designs" ON badge_designs;
CREATE POLICY "Owners and managers can delete badge designs"
  ON badge_designs FOR DELETE
  USING (event_can(event_id, 'manage_badges'));

-- ---------------------------------------------------------------- the event team itself
-- Only an owner can give out, change or remove the 'owner' role, so a manager cannot promote themselves.

DROP POLICY IF EXISTS "Users can view their org's event team" ON event_staff_assignments;
CREATE POLICY "Event members can view the event team"
  ON event_staff_assignments FOR SELECT
  USING (event_can(event_id, 'view_event'));

DROP POLICY IF EXISTS "Admins can assign team members in their org" ON event_staff_assignments;
CREATE POLICY "Owners and managers can assign team members"
  ON event_staff_assignments FOR INSERT
  WITH CHECK (
    event_can(event_id, 'manage_team')
    AND organization_id = current_org_id()
    AND profile_id IN (SELECT id FROM profiles WHERE organization_id = current_org_id())
    AND (role <> 'owner' OR has_event_role(event_id, ARRAY['owner']))
  );

DROP POLICY IF EXISTS "Admins can change team assignments in their org" ON event_staff_assignments;
CREATE POLICY "Owners and managers can change team assignments"
  ON event_staff_assignments FOR UPDATE
  USING (event_can(event_id, 'manage_team') AND (role <> 'owner' OR has_event_role(event_id, ARRAY['owner'])))
  WITH CHECK (
    organization_id = current_org_id()
    AND (role <> 'owner' OR has_event_role(event_id, ARRAY['owner']))
  );

DROP POLICY IF EXISTS "Admins can remove team assignments in their org" ON event_staff_assignments;
CREATE POLICY "Owners and managers can remove team assignments"
  ON event_staff_assignments FOR DELETE
  USING (event_can(event_id, 'manage_team') AND (role <> 'owner' OR has_event_role(event_id, ARRAY['owner'])));

-- "Members can update their own on-site status" (SQL/018) stays, but it matched the whole row.
-- This trigger makes sure a member can change only on_site on their own row.
CREATE OR REPLACE FUNCTION guard_assignment_update() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF ROW(NEW.role, NEW.event_id, NEW.profile_id, NEW.organization_id)
     IS DISTINCT FROM ROW(OLD.role, OLD.event_id, OLD.profile_id, OLD.organization_id) THEN
    IF NOT event_can(OLD.event_id, 'manage_team')
       OR ((OLD.role = 'owner' OR NEW.role = 'owner') AND NOT has_event_role(OLD.event_id, ARRAY['owner'])) THEN
      RAISE EXCEPTION 'You cannot change team roles on this event' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_assignment_update ON event_staff_assignments;
CREATE TRIGGER trg_guard_assignment_update
  BEFORE UPDATE ON event_staff_assignments
  FOR EACH ROW EXECUTE FUNCTION guard_assignment_update();

-- ---------------------------------------------------------------- kiosks (SQL/015)

DROP POLICY IF EXISTS "Org members view their kiosks" ON kiosks;
CREATE POLICY "Owners and managers view kiosks"
  ON kiosks FOR SELECT
  TO authenticated
  USING (event_can(event_id, 'manage_kiosks'));

DROP POLICY IF EXISTS "Org members revoke their kiosks" ON kiosks;
CREATE POLICY "Owners and managers revoke kiosks"
  ON kiosks FOR UPDATE
  TO authenticated
  USING (event_can(event_id, 'manage_kiosks'))
  WITH CHECK (event_can(event_id, 'manage_kiosks'));

CREATE OR REPLACE FUNCTION create_kiosk_pairing(p_event_id UUID, p_label TEXT)
RETURNS TABLE (code TEXT, kiosk_code TEXT, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT := TRIM(BOTH '-' FROM REGEXP_REPLACE(UPPER(COALESCE(p_label, '')), '[^A-Z0-9]+', '-', 'g'));
  v_kiosk_code TEXT;
  v_code TEXT;
  v_expires TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '10 minutes';
  v_try INT := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT event_can(p_event_id, 'manage_kiosks') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = 'P0001';
  END IF;
  IF v_slug = '' THEN v_slug := 'GATE'; END IF;
  v_slug := LEFT(v_slug, 20);
  v_kiosk_code := 'KSK-' || v_slug;
  IF EXISTS (SELECT 1 FROM kiosks k WHERE k.event_id = p_event_id AND k.kiosk_code = v_kiosk_code)
     OR EXISTS (SELECT 1 FROM kiosk_pairings p WHERE p.event_id = p_event_id AND p.kiosk_code = v_kiosk_code
                AND p.used_at IS NULL AND p.expires_at > NOW()) THEN
    RAISE EXCEPTION 'kiosk_name_taken' USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_code := LPAD((((('x' || SUBSTR(MD5(gen_random_uuid()::TEXT), 1, 7))::BIT(28)::INT) % 900000) + 100000)::TEXT, 6, '0');
    BEGIN
      INSERT INTO kiosk_pairings (event_id, code, kiosk_code, label, expires_at)
      VALUES (p_event_id, v_code, v_kiosk_code, LEFT(TRIM(p_label), 40), v_expires);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_try := v_try + 1;
      IF v_try > 10 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_code, v_kiosk_code, v_expires;
END;
$$;

NOTIFY pgrst, 'reload schema';
