-- Event time zone (IANA name, e.g. Asia/Riyadh). Additive only: existing events get NULL
-- and show the start time without a zone until they are saved again.

ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT;
