-- Event venue. The event location (city and country) stays as it is; the venue is separate.
-- Venue types: in_person (venue name and address), virtual (platform and link), tba (not yet confirmed).
-- Existing events become TBA, so nothing is shown as a venue that was never confirmed.

ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_type TEXT NOT NULL DEFAULT 'tba'
  CHECK (venue_type IN ('in_person', 'virtual', 'tba'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_map_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_platform TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_link TEXT;
