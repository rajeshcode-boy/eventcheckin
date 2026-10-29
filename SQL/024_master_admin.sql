-- Step 24: master admin — a single support account (you) that can see every
-- organisation and log in as any of its members to fix a problem for them.
--
-- is_master_admin is a flag on YOUR OWN profile row, set by hand after running
-- this file (see the UPDATE statement at the bottom — edit the email first).
-- It is never set by the app itself.
--
-- Listing other orgs' data has to go through SECURITY DEFINER RPCs (RLS keeps
-- everyone, master admin included, scoped to current_org_id() otherwise).
-- Actually signing in as someone else happens outside Postgres, in
-- app/api/admin/impersonate (service role key, generates a magic-link token) —
-- this file only adds the flag, the audit log table, and the read-only RPCs.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_master_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_master_admin FROM profiles WHERE id = auth.uid()), false)
$$;

REVOKE EXECUTE ON FUNCTION is_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_master_admin() TO authenticated;

-- Every impersonation session, so you can see who logged in as whom and when.
-- Written by the service-role API route, which bypasses RLS; the policies
-- below only govern reading it back from the client (the admin page).
CREATE TABLE IF NOT EXISTS impersonation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_email TEXT NOT NULL,
  reason TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_admin ON impersonation_log(master_admin_id, started_at DESC);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admin can view their own impersonation log" ON impersonation_log;
CREATE POLICY "Master admin can view their own impersonation log"
  ON impersonation_log FOR SELECT
  USING (is_master_admin() AND master_admin_id = auth.uid());

-- Inserts/updates (starting and ending a session) go through the service-role
-- API route, which bypasses RLS entirely — no INSERT/UPDATE policy is needed
-- for the client, and none is granted, so a compromised browser session
-- cannot forge or close log entries on its own.

-- Read-only directory for the admin page: every organisation, with counts.
CREATE OR REPLACE FUNCTION admin_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  member_count BIGINT,
  event_count BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.created_at,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id),
    (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id)
  FROM organizations o
  WHERE is_master_admin()
  ORDER BY o.created_at DESC
$$;

-- Read-only member list for one organisation.
CREATE OR REPLACE FUNCTION admin_list_org_members(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  is_owner BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.role, p.is_owner
  FROM profiles p
  WHERE is_master_admin() AND p.organization_id = p_org_id
  ORDER BY p.is_owner DESC, p.role, p.full_name
$$;

REVOKE EXECUTE ON FUNCTION admin_list_organizations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_list_org_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_organizations() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_org_members(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Run this yourself, with your own email, AFTER applying the file above.
-- Nobody gets master admin just from running this migration.
--
-- UPDATE profiles SET is_master_admin = true WHERE email = 'you@example.com';
