-- Event start time. Additive only: existing events keep working with a NULL time.
-- The time is the local start time at the venue (no timezone stored yet).

ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME;
