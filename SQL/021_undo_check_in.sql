-- Step 21: let event staff undo a check-in from the guest drawer.
-- Until now only a kiosk could undo, and only its own scan. Organisers had no DELETE policy on checkins.
-- This function removes every check-in of one guest and records who did it. It is allowed for the roles
-- that can check people in (owner, manager, staff), checked by event_can() from SQL/020.

CREATE OR REPLACE FUNCTION undo_check_in(p_registration_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event UUID;
  v_name TEXT;
  v_removed INT;
BEGIN
  SELECT r.event_id, r.full_name INTO v_event, v_name FROM registrations r WHERE r.id = p_registration_id;
  IF v_event IS NULL OR auth.uid() IS NULL OR NOT event_can(v_event, 'check_in') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  -- Same lock the kiosk sync takes, so an undo cannot interleave with a scan of the same guest
  PERFORM pg_advisory_xact_lock(HASHTEXTEXTENDED(p_registration_id::TEXT, 0));
  DELETE FROM checkins WHERE registration_id = p_registration_id;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed > 0 THEN
    INSERT INTO admin_actions (actor_id, action, target)
    VALUES (auth.uid(), 'undo_check_in', v_name || ' (' || p_registration_id::TEXT || ')');
  END IF;
  RETURN v_removed;
END;
$$;

REVOKE EXECUTE ON FUNCTION undo_check_in(UUID) FROM PUBLIC;
-- Supabase grants new functions to anon directly, which FROM PUBLIC does not remove
REVOKE EXECUTE ON FUNCTION undo_check_in(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION undo_check_in(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
