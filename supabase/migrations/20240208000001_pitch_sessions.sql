-- Pitch Sessions table for web-based pitch meeting interface
-- Run this migration in Supabase SQL editor

CREATE TABLE IF NOT EXISTS pitch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_name TEXT,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  status TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress|synthesis|approval|generation|completed
  current_round INTEGER NOT NULL DEFAULT 1,
  rounds JSONB NOT NULL DEFAULT '[]',          -- [{round, focus, founderInput, vcResponse}]
  revised_pitch TEXT,
  revised_pitch_approved BOOLEAN DEFAULT FALSE,
  agent_config JSONB,
  worker_config JSONB,
  strategy TEXT,
  configs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for listing recent sessions
CREATE INDEX IF NOT EXISTS pitch_sessions_created_at_idx ON pitch_sessions(created_at DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS pitch_sessions_status_idx ON pitch_sessions(status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pitch_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pitch_sessions_updated_at_trigger ON pitch_sessions;
CREATE TRIGGER pitch_sessions_updated_at_trigger
  BEFORE UPDATE ON pitch_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_pitch_sessions_updated_at();

-- Enable RLS (optional, for authenticated access)
ALTER TABLE pitch_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for service role (used by API routes)
CREATE POLICY "Service role has full access to pitch_sessions"
  ON pitch_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);
