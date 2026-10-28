-- Event team: which organisation member works on which event, in what role, and who is on site.
-- Admins assign people; a member can mark their own on-site status.
-- Additive only: a new table, nothing existing changes.

CREATE TABLE IF NOT EXISTS event_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'other' CHECK (role IN ('coordinator', 'check_in', 'registration', 'badges', 'other')),
  on_site BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_event_team_members_event ON event_team_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_members_org ON event_team_members(organization_id);

ALTER TABLE event_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org's event team" ON event_team_members;
CREATE POLICY "Users can view their org's event team"
  ON event_team_members FOR SELECT
  USING (organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can assign team members in their org" ON event_team_members;
CREATE POLICY "Admins can assign team members in their org"
  ON event_team_members FOR INSERT
  WITH CHECK (is_org_admin() AND organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can change team assignments in their org" ON event_team_members;
CREATE POLICY "Admins can change team assignments in their org"
  ON event_team_members FOR UPDATE
  USING (is_org_admin() AND organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

-- Anyone can mark themselves on site or off, but nothing else about their assignment
DROP POLICY IF EXISTS "Members can update their own on-site status" ON event_team_members;
CREATE POLICY "Members can update their own on-site status"
  ON event_team_members FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid() AND organization_id = current_org_id());

DROP POLICY IF EXISTS "Admins can remove team assignments in their org" ON event_team_members;
CREATE POLICY "Admins can remove team assignments in their org"
  ON event_team_members FOR DELETE
  USING (is_org_admin() AND organization_id = current_org_id());
