-- ============================================================
-- EventPulse Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'committee_lead', 'member')),
  committee_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMMITTEES
-- ============================================================
CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  lead_name TEXT,
  lead_email TEXT,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'stalled', 'critical')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  member_count INTEGER DEFAULT 0,
  submission_streak INTEGER DEFAULT 0,
  last_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MILESTONES
-- ============================================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE NOT NULL,
  committee_id UUID REFERENCES committees(id) ON DELETE SET NULL,
  weight INTEGER NOT NULL DEFAULT 10 CHECK (weight >= 0 AND weight <= 100),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'at_risk', 'completed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DAILY SUBMISSIONS
-- ============================================================
CREATE TABLE daily_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  files JSONB NOT NULL DEFAULT '[]'::JSONB,
  llm_analysis JSONB,
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(committee_id, submission_date)
);

-- ============================================================
-- TASKS (linked to milestones, included in submissions)
-- ============================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID REFERENCES committees(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROGRESS SNAPSHOTS (daily aggregate)
-- ============================================================
CREATE TABLE progress_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  overall_progress INTEGER NOT NULL,
  committee_snapshots JSONB NOT NULL DEFAULT '[]'::JSONB,
  total_submissions INTEGER DEFAULT 0,
  active_blockers INTEGER DEFAULT 0,
  ai_brief TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_date)
);

-- ============================================================
-- FOREIGN KEY: profiles -> committees
-- ============================================================
ALTER TABLE profiles ADD CONSTRAINT profiles_committee_id_fkey
  FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE SET NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_snapshots ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, write own
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_write_own" ON profiles FOR ALL TO authenticated USING (auth.uid() = id);

-- Committees: admin can CRUD, leads/members can read
CREATE POLICY "committees_read_authenticated" ON committees FOR SELECT TO authenticated USING (true);
CREATE POLICY "committees_admin_write" ON committees FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Milestones: admin can CRUD, all authenticated can read
CREATE POLICY "milestones_read_authenticated" ON milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "milestones_admin_write" ON milestones FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Submissions: admin reads all, leads read/write own committee
CREATE POLICY "submissions_admin_read" ON daily_submissions FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "submissions_lead_own_committee" ON daily_submissions FOR ALL TO authenticated
  USING (
    committee_id = (SELECT committee_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Tasks: same as submissions
CREATE POLICY "tasks_read_committee" ON tasks FOR SELECT TO authenticated
  USING (
    committee_id = (SELECT committee_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
CREATE POLICY "tasks_write_committee" ON tasks FOR ALL TO authenticated
  USING (
    committee_id = (SELECT committee_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Progress snapshots: admin only write, all read
CREATE POLICY "snapshots_read_all" ON progress_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "snapshots_admin_write" ON progress_snapshots FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER committees_updated_at BEFORE UPDATE ON committees FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER milestones_updated_at BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- SEED DATA (Sample committees for testing)
-- ============================================================
INSERT INTO committees (name, description, lead_name, lead_email, status, progress_pct, member_count) VALUES
  ('Logistics & Venue', 'Responsible for venue booking, catering, and on-site logistics.', 'Sarah Jenkins', 'sarah@event.com', 'on_track', 82, 8),
  ('Marketing & PR', 'Handles social media, press releases, and branding.', 'David Chen', 'david@event.com', 'stalled', 45, 6),
  ('Tech & AV Services', 'Manages technical infrastructure and A/V.', 'Maya Patel', 'maya@event.com', 'critical', 12, 5),
  ('Finance & Sponsorship', 'Manages budgets, invoices, and sponsors.', 'James Okonkwo', 'james@event.com', 'at_risk', 58, 4),
  ('Programming & Speakers', 'Curates agenda and manages speakers.', 'Aisha Rahman', 'aisha@event.com', 'on_track', 76, 7),
  ('Volunteer Coordination', 'Recruits and manages volunteers.', 'Tom Bradley', 'tom@event.com', 'on_track', 91, 12);
