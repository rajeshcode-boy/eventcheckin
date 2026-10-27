-- Step 14: how an event takes registrations, and where it happens.
--
-- Defaults match today's actual behaviour for every existing event, so this is
-- non-breaking: registration_type 'form' = the always-open online registration
-- link you already have; location_type 'in_person' = the plain text location
-- every event already has.
--
-- 'tickets' is a valid value here so the column doesn't need another migration
-- later, but nothing in the app should offer it yet -- there is no payment
-- processor integrated, so a ticketed event has nowhere to take payment.

ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_type TEXT NOT NULL DEFAULT 'form'
  CHECK (registration_type IN ('none', 'form', 'rsvp', 'tickets'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS location_type TEXT NOT NULL DEFAULT 'in_person'
  CHECK (location_type IN ('in_person', 'virtual', 'tbd'));

-- Only meaningful when location_type = 'virtual'; left blank otherwise.
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_link TEXT;

NOTIFY pgrst, 'reload schema';
