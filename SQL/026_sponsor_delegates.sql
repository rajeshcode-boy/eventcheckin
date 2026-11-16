-- Migration 026: Sponsor Delegates & Booth Staff Passes
-- Isolates sponsor booth representatives from general attendee registrations.
-- Keeps sponsor contacts strictly segregated from general guest downloads while enabling gate check-in & arrival tracking.

CREATE TABLE IF NOT EXISTS event_sponsor_reps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES event_sponsors(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_title TEXT DEFAULT 'Booth Staff', -- e.g. 'Booth Lead', 'Product Specialist', 'Executive'
  pass_code TEXT NOT NULL, -- Unique pass code e.g. 'SP8K2M'
  badge_token TEXT DEFAULT replace(gen_random_uuid()::text, '-', ''),
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,
  checkin_method TEXT, -- 'manual', 'qr', 'kiosk'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sponsor_rep_name_not_empty CHECK (full_name != ''),
  CONSTRAINT sponsor_rep_pass_code_unique UNIQUE (event_id, pass_code)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_reps_event ON event_sponsor_reps(event_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_reps_sponsor ON event_sponsor_reps(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_reps_code ON event_sponsor_reps(event_id, pass_code);
CREATE INDEX IF NOT EXISTS idx_sponsor_reps_token ON event_sponsor_reps(badge_token);

-- Enable RLS
ALTER TABLE event_sponsor_reps ENABLE ROW LEVEL SECURITY;

-- Anyone with event access can view sponsor reps
DROP POLICY IF EXISTS "Anyone can view sponsor reps" ON event_sponsor_reps;
CREATE POLICY "Anyone can view sponsor reps"
  ON event_sponsor_reps FOR SELECT
  USING (true);

-- Organizers can manage sponsor reps
DROP POLICY IF EXISTS "Organizers can insert sponsor reps" ON event_sponsor_reps;
CREATE POLICY "Organizers can insert sponsor reps"
  ON event_sponsor_reps FOR INSERT
  WITH CHECK (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can update sponsor reps" ON event_sponsor_reps;
CREATE POLICY "Organizers can update sponsor reps"
  ON event_sponsor_reps FOR UPDATE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can delete sponsor reps" ON event_sponsor_reps;
CREATE POLICY "Organizers can delete sponsor reps"
  ON event_sponsor_reps FOR DELETE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'delete_guests')
  );
