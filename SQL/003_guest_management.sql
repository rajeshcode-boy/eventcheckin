-- Step 2: guest list management
-- Admins can delete registrations (bulk delete on the guest list page).
-- Check-ins and badge prints for a deleted guest are removed by ON DELETE CASCADE.
CREATE POLICY "Admins can delete registrations for their org's events"
  ON registrations FOR DELETE
  USING (
    is_org_admin()
    AND event_id IN (SELECT id FROM events WHERE organization_id = current_org_id())
  );
