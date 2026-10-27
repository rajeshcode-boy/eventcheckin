-- Step 12: web push notifications. Organisers (logged in) and guests (badge link, no login)
-- can subscribe a browser or home-screen app. Each row is one browser push subscription.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  -- Organiser devices: the logged-in user. Guest devices: the guest's badge token.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_token TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT push_subscriptions_owner CHECK (user_id IS NOT NULL OR badge_token IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_badge ON push_subscriptions(badge_token);

-- Row Level Security: a logged-in user can read only their own devices.
-- No direct insert/update/delete policies: writes go through the functions below,
-- and the server sends notifications with the service role key (which bypasses RLS).
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users read their own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Organiser: save this browser's subscription for the logged-in user
CREATE OR REPLACE FUNCTION save_push_subscription(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to turn on notifications';
  END IF;
  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Incomplete push subscription';
  END IF;

  INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key, user_id, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, auth.uid(), LEFT(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_id = EXCLUDED.user_id,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW();
END;
$$;

-- Guest: save this device's subscription for a registration, identified by its badge link token
CREATE OR REPLACE FUNCTION public_subscribe_guest(
  p_badge_token TEXT, p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM registrations r WHERE r.badge_token = p_badge_token) THEN
    RAISE EXCEPTION 'This badge link is not valid';
  END IF;
  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Incomplete push subscription';
  END IF;

  INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key, badge_token, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, p_badge_token, LEFT(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    badge_token = EXCLUDED.badge_token,
    user_agent = EXCLUDED.user_agent,
    updated_at = NOW();
END;
$$;

-- Turn off: remove one device's subscription. The endpoint URL is only known to that browser.
CREATE OR REPLACE FUNCTION remove_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint
$$;

REVOKE EXECUTE ON FUNCTION save_push_subscription(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public_subscribe_guest(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_subscribe_guest(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION remove_push_subscription(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_push_subscription(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
