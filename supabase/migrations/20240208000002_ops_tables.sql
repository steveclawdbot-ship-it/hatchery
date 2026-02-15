-- Ops tables for the Hatchery engine runtime
-- Run this migration in Supabase SQL editor or via `supabase db push`

-- ============================================================
-- ops_policies: key-value config store for runtime settings
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_policies (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT
);

-- ============================================================
-- ops_events: append-only event log for all agent activity
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  payload JSONB,
  visibility TEXT NOT NULL DEFAULT 'internal',
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_events_created_at_idx ON ops_events(created_at DESC);
CREATE INDEX IF NOT EXISTS ops_events_agent_id_idx ON ops_events(agent_id);
CREATE INDEX IF NOT EXISTS ops_events_kind_idx ON ops_events(kind);

-- ============================================================
-- ops_proposals: agent-submitted work proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  proposed_steps JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  source_trace_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_proposals_agent_id_idx ON ops_proposals(agent_id);
CREATE INDEX IF NOT EXISTS ops_proposals_status_idx ON ops_proposals(status);

-- ============================================================
-- ops_missions: approved proposals promoted to missions
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES ops_proposals(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_missions_status_idx ON ops_missions(status);
CREATE INDEX IF NOT EXISTS ops_missions_created_by_idx ON ops_missions(created_by);

-- ============================================================
-- ops_steps: individual execution steps within missions
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES ops_missions(id),
  step_number INTEGER NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  output JSONB,
  reserved_by TEXT,
  reserved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_steps_mission_id_idx ON ops_steps(mission_id);
CREATE INDEX IF NOT EXISTS ops_steps_status_idx ON ops_steps(status);

-- ============================================================
-- ops_conversations: multi-agent dialogue records
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  topic TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]',
  turns JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ,
  memories_extracted BOOLEAN DEFAULT FALSE,
  action_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_conversations_format_idx ON ops_conversations(format);

-- ============================================================
-- ops_memories: agent knowledge with confidence scores
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  tags TEXT[] DEFAULT '{}',
  superseded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_memories_agent_id_idx ON ops_memories(agent_id);
CREATE INDEX IF NOT EXISTS ops_memories_type_idx ON ops_memories(type);
CREATE INDEX IF NOT EXISTS ops_memories_confidence_idx ON ops_memories(confidence DESC);

-- ============================================================
-- ops_relationships: pairwise agent affinity tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_relationships (
  agent_a TEXT NOT NULL,
  agent_b TEXT NOT NULL,
  affinity NUMERIC NOT NULL DEFAULT 0.5,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  positive_interactions INTEGER NOT NULL DEFAULT 0,
  negative_interactions INTEGER NOT NULL DEFAULT 0,
  drift_log JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (agent_a, agent_b)
);

-- ============================================================
-- ops_triggers: event-driven automation rules
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_pattern TEXT NOT NULL,
  condition JSONB,
  proposal_template JSONB NOT NULL,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  fire_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- ops_reactions: agent-specific event responses
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  event_pattern TEXT NOT NULL,
  probability NUMERIC NOT NULL DEFAULT 0.5,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  proposal_template JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_reactions_agent_id_idx ON ops_reactions(agent_id);

-- ============================================================
-- ops_initiatives: agent self-initiated proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ops_step_registry: catalog of available step kinds
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_step_registry (
  kind TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  worker_type TEXT NOT NULL,
  description TEXT NOT NULL,
  required_config TEXT[],
  cap_gate_policy_key TEXT
);

-- ============================================================
-- ops_action_runs: heartbeat and action execution log
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_action_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ops_action_runs_action_idx ON ops_action_runs(action);

-- ============================================================
-- RPC: claim_step — atomically reserve a step for a worker
-- ============================================================
CREATE OR REPLACE FUNCTION claim_step(p_step_id UUID, p_worker_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  claimed BOOLEAN := FALSE;
BEGIN
  UPDATE ops_steps
  SET reserved_by = p_worker_id,
      reserved_at = NOW(),
      status = 'running'
  WHERE id = p_step_id
    AND status = 'queued'
    AND reserved_by IS NULL;

  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RPC: complete_step — finish a step and maybe complete mission
-- ============================================================
CREATE OR REPLACE FUNCTION complete_step(p_step_id UUID, p_status TEXT, p_output JSONB)
RETURNS VOID AS $$
DECLARE
  v_mission_id UUID;
  v_total INTEGER;
  v_done INTEGER;
BEGIN
  UPDATE ops_steps
  SET status = p_status,
      output = p_output,
      completed_at = NOW()
  WHERE id = p_step_id
  RETURNING mission_id INTO v_mission_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('succeeded', 'failed'))
  INTO v_total, v_done
  FROM ops_steps
  WHERE mission_id = v_mission_id;

  IF v_done >= v_total THEN
    UPDATE ops_missions
    SET status = CASE
          WHEN EXISTS (SELECT 1 FROM ops_steps WHERE mission_id = v_mission_id AND status = 'failed')
          THEN 'failed'
          ELSE 'succeeded'
        END,
        completed_at = NOW()
    WHERE id = v_mission_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS: enable and allow service role full access
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'ops_policies', 'ops_events', 'ops_proposals', 'ops_missions',
      'ops_steps', 'ops_conversations', 'ops_memories', 'ops_relationships',
      'ops_triggers', 'ops_reactions', 'ops_initiatives', 'ops_step_registry',
      'ops_action_runs'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'CREATE POLICY "Service role has full access to %I" ON %I FOR ALL USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;
