-- Migration 025: Speakers and Sponsors Management
-- Supports conference speaker rosters, talk sessions, custom sponsor tiers, booth allocations and rep pass quotas.

-- 1. Speakers Table
CREATE TABLE IF NOT EXISTS event_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  designation TEXT,
  bio TEXT,
  photo_url TEXT,
  talk_title TEXT,
  session_type TEXT DEFAULT 'Keynote', -- Keynote, Panel, Breakout, Workshop, Fireside Chat, Lightning Talk
  stage_room TEXT, -- e.g. 'Main Auditorium', 'Hall A'
  session_time TEXT, -- e.g. '10:00 AM - 10:45 AM'
  session_date DATE,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  featured BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT speaker_name_not_empty CHECK (full_name != '')
);

CREATE INDEX IF NOT EXISTS idx_event_speakers_event ON event_speakers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_speakers_sort ON event_speakers(event_id, sort_order, created_at);

-- 2. Sponsors Table (Custom Tiers)
CREATE TABLE IF NOT EXISTS event_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tier TEXT NOT NULL, -- Organizer custom tier name, e.g. 'Title Partner', 'Platinum', 'Gold', 'Powered by'
  logo_url TEXT,
  website TEXT,
  booth_number TEXT, -- e.g. 'Booth A-12', 'Table 4'
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  rep_pass_quota INT DEFAULT 2, -- Complimentary staff passes
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sponsor_name_not_empty CHECK (name != ''),
  CONSTRAINT sponsor_tier_not_empty CHECK (tier != '')
);

CREATE INDEX IF NOT EXISTS idx_event_sponsors_event ON event_sponsors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_sponsors_tier ON event_sponsors(event_id, tier);

-- Enable Row Level Security
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

-- Speakers RLS Policies
DROP POLICY IF EXISTS "Anyone can view event speakers" ON event_speakers;
CREATE POLICY "Anyone can view event speakers"
  ON event_speakers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Organizers can insert speakers" ON event_speakers;
CREATE POLICY "Organizers can insert speakers"
  ON event_speakers FOR INSERT
  WITH CHECK (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can update speakers" ON event_speakers;
CREATE POLICY "Organizers can update speakers"
  ON event_speakers FOR UPDATE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can delete speakers" ON event_speakers;
CREATE POLICY "Organizers can delete speakers"
  ON event_speakers FOR DELETE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'delete_guests')
  );

-- Sponsors RLS Policies
DROP POLICY IF EXISTS "Anyone can view event sponsors" ON event_sponsors;
CREATE POLICY "Anyone can view event sponsors"
  ON event_sponsors FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Organizers can insert sponsors" ON event_sponsors;
CREATE POLICY "Organizers can insert sponsors"
  ON event_sponsors FOR INSERT
  WITH CHECK (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can update sponsors" ON event_sponsors;
CREATE POLICY "Organizers can update sponsors"
  ON event_sponsors FOR UPDATE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'edit_guests')
  );

DROP POLICY IF EXISTS "Organizers can delete sponsors" ON event_sponsors;
CREATE POLICY "Organizers can delete sponsors"
  ON event_sponsors FOR DELETE
  USING (
    event_can(event_id, 'edit_event')
    OR event_can(event_id, 'delete_guests')
  );
