-- Step 27: Commercial limitations, plan tiers, and license key activation for PayPal payments.

-- 1. Add plan_tier and overrides to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'enterprise'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_attendees_override INT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS max_events_override INT;

-- 2. Create license_keys table
CREATE TABLE IF NOT EXISTS license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  target_tier TEXT NOT NULL DEFAULT 'pro' CHECK (target_tier IN ('starter', 'pro', 'enterprise')),
  duration_days INT DEFAULT 365,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(key);
CREATE INDEX IF NOT EXISTS idx_license_keys_used_by ON license_keys(used_by_org_id);

ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Only master admin can read/write license_keys directly; regular users interact via redeem_license_key()
DROP POLICY IF EXISTS "Master admin can view license keys" ON license_keys;
CREATE POLICY "Master admin can view license keys"
  ON license_keys FOR SELECT
  USING (is_master_admin());

DROP POLICY IF EXISTS "Master admin can manage license keys" ON license_keys;
CREATE POLICY "Master admin can manage license keys"
  ON license_keys FOR ALL
  USING (is_master_admin())
  WITH CHECK (is_master_admin());

-- 3. RPC to redeem license key (called by authenticated organization admin)
CREATE OR REPLACE FUNCTION public.redeem_license_key(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_user_role TEXT;
  v_key_row RECORD;
  v_clean_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'You must be signed in to redeem a license.');
  END IF;

  -- Check user profile and organization
  SELECT organization_id, role INTO v_org_id, v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Organization not found.');
  END IF;

  IF v_user_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only organization admins can redeem license keys.');
  END IF;

  v_clean_key := UPPER(TRIM(p_key));

  -- Find unused key
  SELECT * INTO v_key_row
  FROM license_keys
  WHERE UPPER(key) = v_clean_key;

  IF v_key_row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid license key. Please check the code.');
  END IF;

  IF v_key_row.is_used THEN
    RETURN jsonb_build_object('success', false, 'message', 'This license key has already been redeemed.');
  END IF;

  -- Mark key as used
  UPDATE license_keys
  SET is_used = true,
      used_by_org_id = v_org_id,
      used_at = NOW()
  WHERE id = v_key_row.id;

  -- Upgrade organization plan
  UPDATE organizations
  SET plan_tier = v_key_row.target_tier,
      plan_updated_at = NOW()
  WHERE id = v_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_key_row.target_tier,
    'message', 'License activated! Your organization has been upgraded to ' || UPPER(v_key_row.target_tier) || '.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION redeem_license_key(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_license_key(TEXT) TO authenticated;

-- 4. Master Admin RPC: directly switch an organization's plan
CREATE OR REPLACE FUNCTION public.admin_set_organization_plan(
  p_org_id UUID,
  p_tier TEXT,
  p_max_attendees INT DEFAULT NULL,
  p_max_events INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Access denied. Master admin privileges required.';
  END IF;

  IF p_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid tier. Must be starter, pro, or enterprise.';
  END IF;

  UPDATE organizations
  SET plan_tier = p_tier,
      plan_updated_at = NOW(),
      max_attendees_override = p_max_attendees,
      max_events_override = p_max_events
  WHERE id = p_org_id;

  RETURN jsonb_build_object('success', true, 'tier', p_tier);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_organization_plan(UUID, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_organization_plan(UUID, TEXT, INT, INT) TO authenticated;

-- 5. Master Admin RPC: generate a new license key
CREATE OR REPLACE FUNCTION public.admin_generate_license_key(
  p_tier TEXT DEFAULT 'pro',
  p_notes TEXT DEFAULT NULL,
  p_duration_days INT DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_key TEXT;
  v_chunk1 TEXT;
  v_chunk2 TEXT;
  v_chunk3 TEXT;
BEGIN
  IF NOT is_master_admin() THEN
    RAISE EXCEPTION 'Access denied. Master admin privileges required.';
  END IF;

  IF p_tier NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid tier. Must be starter, pro, or enterprise.';
  END IF;

  -- Generate readable code format: PRO-A8K2-9M4Q-7P1L
  v_chunk1 := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
  v_chunk2 := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 5, 4));
  v_chunk3 := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 9, 4));
  v_new_key := UPPER(p_tier) || '-' || v_chunk1 || '-' || v_chunk2 || '-' || v_chunk3;

  INSERT INTO license_keys (key, target_tier, duration_days, created_by, notes)
  VALUES (v_new_key, p_tier, p_duration_days, auth.uid(), p_notes);

  RETURN jsonb_build_object(
    'success', true,
    'key', v_new_key,
    'tier', p_tier
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_generate_license_key(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_generate_license_key(TEXT, TEXT, INT) TO authenticated;

-- 6. Master Admin RPC: list all license keys
CREATE OR REPLACE FUNCTION public.admin_list_license_keys()
RETURNS TABLE (
  id UUID,
  key TEXT,
  target_tier TEXT,
  duration_days INT,
  is_used BOOLEAN,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_org_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.id,
    k.key,
    k.target_tier,
    k.duration_days,
    k.is_used,
    k.used_at,
    o.name AS used_by_org_name,
    k.notes,
    k.created_at
  FROM license_keys k
  LEFT JOIN organizations o ON o.id = k.used_by_org_id
  WHERE is_master_admin()
  ORDER BY k.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_license_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_license_keys() TO authenticated;

-- 7. Update admin_list_organizations to return plan information
CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  member_count BIGINT,
  event_count BIGINT,
  plan_tier TEXT,
  max_attendees_override INT,
  max_events_override INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.created_at,
    (SELECT COUNT(*) FROM profiles p WHERE p.organization_id = o.id),
    (SELECT COUNT(*) FROM events e WHERE e.organization_id = o.id),
    COALESCE(o.plan_tier, 'starter'),
    o.max_attendees_override,
    o.max_events_override
  FROM organizations o
  WHERE is_master_admin()
  ORDER BY o.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION admin_list_organizations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_organizations() TO authenticated;

NOTIFY pgrst, 'reload schema';
