-- Archive and delete events.
-- Archived events are hidden from the lists but keep all their data (archived_at is set).
-- Deleting an event removes it; its guests, check-ins, badges, team assignments and
-- other child rows are removed too, because they already cascade from events.
-- Only admins of the event's organisation can delete events.

ALTER TABLE events ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

DROP POLICY IF EXISTS "Admins can delete events in their org" ON events;
CREATE POLICY "Admins can delete events in their org"
  ON events FOR DELETE
  USING (is_org_admin() AND organization_id = current_org_id());
