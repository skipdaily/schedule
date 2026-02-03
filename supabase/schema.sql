-- Sheduler Supabase schema

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_state (
  id int PRIMARY KEY,
  current_project_id text,
  updated_at timestamptz DEFAULT now()
);

-- Seed app_state row
INSERT INTO app_state (id, current_project_id)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- If you are not using Auth, you can disable RLS for now:
-- ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_state DISABLE ROW LEVEL SECURITY;
