-- Step 15: paired check-in kiosks (tablets at gates).
-- An organiser creates a one-time 6-digit pairing code for an event; the tablet exchanges it for a
-- kiosk code (e.g. KSK-GATE-01) and a secret token. The token (stored only as a SHA-256 hash) lets
-- the tablet download the guest list and upload scans in batches, including scans made offline.
-- Check-ins are serialised per guest, so two gates scanning the same ticket cannot both win.

-- ---------------------------------------------------------------- tables

CREATE TABLE IF NOT EXISTS kiosks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  kiosk_code TEXT NOT NULL,                 -- e.g. KSK-GATE-01
  label TEXT NOT NULL,                      -- e.g. Gate 1
  token_hash TEXT NOT NULL UNIQUE,          -- sha256 of the secret token; the token itself is never stored
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (event_id, kiosk_code)
);

CREATE TABLE IF NOT EXISTS kiosk_pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  kiosk_code TEXT NOT NULL,
  label TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kiosk_pairings_open_code ON kiosk_pairings(code) WHERE used_at IS NULL;

-- Per-event secret used as the Realtime broadcast channel name, so only paired kiosks can listen.
CREATE TABLE IF NOT EXISTS kiosk_event_keys (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  channel_key TEXT NOT NULL DEFAULT REPLACE(gen_random_uuid()::TEXT, '-', '')
);

-- Failed pairing attempts, used to slow down guessing of the 6-digit code.
CREATE TABLE IF NOT EXISTS kiosk_pair_failures (
  id BIGSERIAL PRIMARY KEY,
  failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE checkins ADD COLUMN IF NOT EXISTS kiosk_id UUID REFERENCES kiosks(id) ON DELETE SET NULL;
-- Set by the kiosk for every scan, so retrying an upload can never create a second check-in.
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS client_scan_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_client_scan_id ON checkins(client_scan_id) WHERE client_scan_id IS NOT NULL;

-- ---------------------------------------------------------------- RLS
-- Organisers see and revoke their own org's kiosks. Everything else goes through the functions below.

ALTER TABLE kiosks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_event_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_pair_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members view their kiosks" ON kiosks;
CREATE POLICY "Org members view their kiosks"
  ON kiosks FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

DROP POLICY IF EXISTS "Org members revoke their kiosks" ON kiosks;
CREATE POLICY "Org members revoke their kiosks"
  ON kiosks FOR UPDATE
  TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE organization_id = current_org_id()));

-- ---------------------------------------------------------------- helpers (not callable from the API)

CREATE OR REPLACE FUNCTION kiosk_sha256(p_text TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$ SELECT encode(sha256(convert_to(p_text, 'UTF8')), 'hex') $$;

-- Resolve a token to its kiosk, or fail. Also records that the kiosk is alive.
CREATE OR REPLACE FUNCTION kiosk_auth(p_token TEXT) RETURNS kiosks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk kiosks;
BEGIN
  SELECT k.* INTO v_kiosk FROM kiosks k
  WHERE k.token_hash = kiosk_sha256(COALESCE(p_token, '')) AND k.revoked_at IS NULL;
  IF v_kiosk.id IS NULL THEN
    RAISE EXCEPTION 'invalid_kiosk' USING ERRCODE = 'P0001';
  END IF;
  UPDATE kiosks SET last_seen_at = NOW() WHERE id = v_kiosk.id;
  RETURN v_kiosk;
END;
$$;
REVOKE ALL ON FUNCTION kiosk_sha256(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION kiosk_auth(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------- organiser: create a pairing code

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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organization_id = current_org_id()
  ) THEN
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

-- ---------------------------------------------------------------- kiosk: pair with a code

CREATE OR REPLACE FUNCTION kiosk_pair(p_code TEXT)
RETURNS TABLE (kiosk_code TEXT, label TEXT, token TEXT, event_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pairing kiosk_pairings;
  v_token TEXT := REPLACE(gen_random_uuid()::TEXT, '-', '') || REPLACE(gen_random_uuid()::TEXT, '-', '');
BEGIN
  DELETE FROM kiosk_pair_failures WHERE failed_at < NOW() - INTERVAL '1 hour';
  IF (SELECT COUNT(*) FROM kiosk_pair_failures WHERE failed_at > NOW() - INTERVAL '1 minute') >= 20 THEN
    RAISE EXCEPTION 'too_many_attempts' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.* INTO v_pairing FROM kiosk_pairings p
  WHERE p.code = TRIM(COALESCE(p_code, '')) AND p.used_at IS NULL AND p.expires_at > NOW()
  FOR UPDATE;
  IF v_pairing.id IS NULL THEN
    INSERT INTO kiosk_pair_failures DEFAULT VALUES;
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  UPDATE kiosk_pairings SET used_at = NOW() WHERE id = v_pairing.id;
  INSERT INTO kiosks (event_id, kiosk_code, label, token_hash)
  VALUES (v_pairing.event_id, v_pairing.kiosk_code, v_pairing.label, kiosk_sha256(v_token));

  RETURN QUERY
  SELECT v_pairing.kiosk_code, v_pairing.label, v_token, e.name
  FROM events e WHERE e.id = v_pairing.event_id;
END;
$$;

-- ---------------------------------------------------------------- kiosk: guest list for the offline cache
-- Needs the kiosk token. Includes names, emails and company, so a stolen tablet should be revoked.
-- Badge tokens are NOT returned; the tablet gets a hash it can compare against a scanned badge link.

CREATE OR REPLACE FUNCTION kiosk_roster(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk kiosks := kiosk_auth(p_token);
  v_key TEXT;
BEGIN
  INSERT INTO kiosk_event_keys (event_id) VALUES (v_kiosk.event_id) ON CONFLICT DO NOTHING;
  SELECT channel_key INTO v_key FROM kiosk_event_keys WHERE event_id = v_kiosk.event_id;

  RETURN jsonb_build_object(
    'kiosk', jsonb_build_object('kiosk_code', v_kiosk.kiosk_code, 'label', v_kiosk.label),
    'event_name', (SELECT e.name FROM events e WHERE e.id = v_kiosk.event_id),
    'channel_key', v_key,
    'synced_at', NOW(),
    'guests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'registration_id', r.registration_id,
        'full_name', r.full_name,
        'email', r.email,
        'company', r.company,
        'designation', r.designation,
        'badge_hash', kiosk_sha256(r.badge_token),
        'checked_in_at', c.checked_in_at,
        'checked_in_by', COALESCE(k.kiosk_code, c.checked_in_by)
      ) ORDER BY r.full_name)
      FROM registrations r
      LEFT JOIN LATERAL (
        SELECT c1.checked_in_at, c1.checked_in_by, c1.kiosk_id
        FROM checkins c1 WHERE c1.registration_id = r.id ORDER BY c1.checked_in_at LIMIT 1
      ) c ON TRUE
      LEFT JOIN kiosks k ON k.id = c.kiosk_id
      WHERE r.event_id = v_kiosk.event_id
    ), '[]'::JSONB)
  );
END;
$$;

-- ---------------------------------------------------------------- kiosk: upload scans (online or from the offline queue)
-- p_scans: [{ "scan_id": uuid, "registration_uuid": uuid, "scanned_at": timestamptz, "method": "qr"|"manual" }]
-- Returns one result per scan, in order:
--   status 'checked_in'          this scan created the check-in (also returned when the same scan_id is retried)
--   status 'already_checked_in'  someone else got there first; by_kiosk / checked_in_at say who and when
--   status 'not_found'           the guest is not on this kiosk's event
-- The first scan to reach the database wins. A queued offline scan keeps its own scanned_at as the
-- check-in time (clamped to the last 24 hours and never in the future).

CREATE OR REPLACE FUNCTION kiosk_sync_batch(p_token TEXT, p_scans JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk kiosks := kiosk_auth(p_token);
  v_scan JSONB;
  v_scan_id UUID;
  v_reg registrations;
  v_existing RECORD;
  v_at TIMESTAMP WITH TIME ZONE;
  v_method TEXT;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_scans IS NULL OR JSONB_TYPEOF(p_scans) <> 'array' OR JSONB_ARRAY_LENGTH(p_scans) > 200 THEN
    RAISE EXCEPTION 'invalid_batch' USING ERRCODE = 'P0001';
  END IF;

  FOR v_scan IN SELECT * FROM JSONB_ARRAY_ELEMENTS(p_scans) LOOP
    v_scan_id := (v_scan->>'scan_id')::UUID;
    v_method := CASE WHEN v_scan->>'method' = 'qr' THEN 'qr' ELSE 'manual' END;
    v_at := LEAST(COALESCE((v_scan->>'scanned_at')::TIMESTAMPTZ, NOW()), NOW());
    IF v_at < NOW() - INTERVAL '24 hours' THEN v_at := NOW(); END IF;

    SELECT r.* INTO v_reg FROM registrations r
    WHERE r.id = (v_scan->>'registration_uuid')::UUID AND r.event_id = v_kiosk.event_id;
    IF v_reg.id IS NULL THEN
      v_results := v_results || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('scan_id', v_scan_id, 'status', 'not_found'));
      CONTINUE;
    END IF;

    -- One check-in at a time per guest: a second gate waits here, then sees the first one's row.
    PERFORM pg_advisory_xact_lock(HASHTEXTEXTENDED(v_reg.id::TEXT, 0));

    SELECT c.id, c.client_scan_id, c.checked_in_at, COALESCE(k.kiosk_code, c.checked_in_by) AS by_kiosk
    INTO v_existing
    FROM checkins c LEFT JOIN kiosks k ON k.id = c.kiosk_id
    WHERE c.registration_id = v_reg.id
    ORDER BY (c.client_scan_id = v_scan_id) DESC NULLS LAST, c.checked_in_at
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      INSERT INTO checkins (registration_id, event_id, method, checked_in_by, checked_in_at, kiosk_id, client_scan_id)
      VALUES (v_reg.id, v_kiosk.event_id, v_method, v_kiosk.kiosk_code, v_at, v_kiosk.id, v_scan_id);
      v_results := v_results || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'scan_id', v_scan_id, 'status', 'checked_in', 'registration_uuid', v_reg.id,
        'full_name', v_reg.full_name, 'checked_in_at', v_at, 'by_kiosk', v_kiosk.kiosk_code));
    ELSIF v_existing.client_scan_id = v_scan_id THEN
      -- Same scan uploaded twice (retry after a dropped response)
      v_results := v_results || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'scan_id', v_scan_id, 'status', 'checked_in', 'registration_uuid', v_reg.id,
        'full_name', v_reg.full_name, 'checked_in_at', v_existing.checked_in_at, 'by_kiosk', v_existing.by_kiosk));
    ELSE
      v_results := v_results || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
        'scan_id', v_scan_id, 'status', 'already_checked_in', 'registration_uuid', v_reg.id,
        'full_name', v_reg.full_name, 'checked_in_at', v_existing.checked_in_at, 'by_kiosk', v_existing.by_kiosk));
    END IF;
  END LOOP;

  RETURN v_results;
END;
$$;

-- ---------------------------------------------------------------- kiosk: undo its own scan

CREATE OR REPLACE FUNCTION kiosk_undo(p_token TEXT, p_scan_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kiosk kiosks := kiosk_auth(p_token);
  v_deleted INT;
BEGIN
  DELETE FROM checkins WHERE client_scan_id = p_scan_id AND kiosk_id = v_kiosk.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- ---------------------------------------------------------------- grants

REVOKE EXECUTE ON FUNCTION create_kiosk_pairing(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kiosk_pair(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kiosk_roster(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kiosk_sync_batch(TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION kiosk_undo(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_kiosk_pairing(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION kiosk_pair(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kiosk_roster(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kiosk_sync_batch(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION kiosk_undo(TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
