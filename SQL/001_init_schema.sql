-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT org_name_not_empty CHECK (name != '')
);

-- Create profiles table (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  designation TEXT,
  phone TEXT,
  location TEXT,
  profile_photo_url TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT profile_name_not_empty CHECK (full_name != '')
);

-- Create events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, -- e.g., TECHFEST-BLR-15NOV2026
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  event_date DATE NOT NULL,
  capacity INT NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT event_name_not_empty CHECK (name != ''),
  CONSTRAINT event_location_not_empty CHECK (location != ''),
  CONSTRAINT event_capacity_positive CHECK (capacity > 0),
  UNIQUE (organization_id, event_id)
);

-- Create registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id TEXT NOT NULL, -- 6-char unique per event, e.g., A7K9Q2
  source TEXT NOT NULL CHECK (source IN ('import', 'manual', 'walkin')),
  source_id TEXT, -- original source ID, e.g., Jotform submission ID
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  designation TEXT,
  company TEXT,
  company_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT reg_name_not_empty CHECK (full_name != ''),
  CONSTRAINT reg_id_format CHECK (registration_id ~ '^[A-Z0-9]{6}$'),
  UNIQUE (event_id, registration_id)
);

-- Create checkins table
CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  method TEXT NOT NULL CHECK (method IN ('qr', 'manual', 'walkin')),
  checked_in_by TEXT, -- staff member name or 'walkin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create badge_prints table (for tracking badge printing)
CREATE TABLE badge_prints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  printed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  printed_by TEXT NOT NULL, -- staff member name
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create import_jobs table
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  row_count INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create admin_actions table (audit log)
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indices for performance
CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
-- One registration per email per event (partial unique index; UNIQUE constraints can't take WHERE)
CREATE UNIQUE INDEX idx_registrations_email ON registrations(event_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_checkins_registration ON checkins(registration_id);
CREATE INDEX idx_checkins_event ON checkins(event_id);
CREATE INDEX idx_checkins_timestamp ON checkins(checked_in_at);
CREATE INDEX idx_badge_prints_registration ON badge_prints(registration_id);
CREATE INDEX idx_import_jobs_event ON import_jobs(event_id);
CREATE INDEX idx_admin_actions_actor ON admin_actions(actor_id);

-- On signup, create the user's organization and admin profile.
-- Runs as the table owner, so it works before the user has a session
-- (e.g. while email confirmation is pending). Signup passes full_name and
-- org_name in auth.signUp({ options: { data } }).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  INSERT INTO organizations (name)
  VALUES (COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'org_name'), ''), 'My Organization'))
  RETURNING id INTO v_org_id;

  INSERT INTO profiles (id, organization_id, full_name, email, role)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'admin'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
