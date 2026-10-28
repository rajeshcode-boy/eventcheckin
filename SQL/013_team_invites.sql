-- Step 13: invite real teammates by email, with a protected Owner.
--
-- profiles.role stays ('admin' | 'staff') unchanged everywhere it's already checked
-- (is_org_admin(), existing RLS policies). is_owner marks the one admin who cannot
-- be demoted or have ownership taken away, even by another admin.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- Existing organizations have no owner yet: mark each one's earliest admin as owner.
WITH first_admin AS (
  SELECT DISTINCT ON (organization_id) id
  FROM profiles
  WHERE role = 'admin'
  ORDER BY organization_id, created_at ASC
)
UPDATE profiles SET is_owner = TRUE WHERE id IN (SELECT id FROM first_admin);

-- Pending/sent invites. The actual account is created via the Supabase Admin API
-- (supabase.auth.admin.inviteUserByEmail), which inserts a row into auth.users and
-- fires handle_new_user() below immediately — this table is for the Team Members UI
-- (who was invited, by whom, with what role) and lets an admin revoke before accept.
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(organization_id);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view their org's invites" ON team_invites;
CREATE POLICY "Admins can view their org's invites"
  ON team_invites FOR SELECT
  USING (organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can create invites in their org" ON team_invites;
CREATE POLICY "Admins can create invites in their org"
  ON team_invites FOR INSERT
  WITH CHECK (is_org_admin() AND organization_id = current_org_id() AND invited_by = auth.uid());

DROP POLICY IF EXISTS "Admins can revoke invites in their org" ON team_invites;
CREATE POLICY "Admins can revoke invites in their org"
  ON team_invites FOR UPDATE
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Extend signup: if the new auth user carries invited_org_id/invited_role (set by the
-- server when it calls inviteUserByEmail), join that org instead of creating a new one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_invited_org_id UUID;
  v_invited_role TEXT;
BEGIN
  v_invited_org_id := NULLIF(NEW.raw_user_meta_data->>'invited_org_id', '')::UUID;
  v_invited_role := NULLIF(NEW.raw_user_meta_data->>'invited_role', '');

  IF v_invited_org_id IS NOT NULL AND v_invited_role IN ('admin', 'staff') THEN
    INSERT INTO profiles (id, organization_id, full_name, email, role)
    VALUES (
      NEW.id,
      v_invited_org_id,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
      NEW.email,
      v_invited_role
    );

    UPDATE team_invites SET status = 'accepted'
    WHERE organization_id = v_invited_org_id AND LOWER(email) = LOWER(NEW.email) AND status = 'pending';

    RETURN NEW;
  END IF;

  INSERT INTO organizations (name)
  VALUES (COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'org_name'), ''), 'My Organization'))
  RETURNING id INTO v_org_id;

  INSERT INTO profiles (id, organization_id, full_name, email, role, is_owner)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'admin',
    TRUE
  );

  RETURN NEW;
END;
$$;

-- Extend the existing self-edit guard: nobody (including another admin) can take
-- ownership away from the owner or demote their role through a normal UPDATE.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.id = auth.uid() AND (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.email IS DISTINCT FROM OLD.email
  ) THEN
    RAISE EXCEPTION 'You cannot change your own role, organization or email here';
  END IF;

  IF OLD.is_owner AND (NEW.is_owner IS DISTINCT FROM TRUE OR NEW.role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'The organization owner cannot be changed here';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
