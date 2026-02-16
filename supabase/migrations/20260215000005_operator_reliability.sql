-- Operator reliability baseline:
-- 1) intervention queue table
-- 2) runtime health summary function
-- 3) default alert thresholds policy

CREATE TABLE IF NOT EXISTS ops_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  step_id UUID REFERENCES ops_steps(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES ops_missions(id) ON DELETE SET NULL,
  action_run_id UUID REFERENCES ops_action_runs(id) ON DELETE SET NULL,
  assigned_to TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ops_interventions_status_idx
  ON ops_interventions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_interventions_severity_idx
  ON ops_interventions(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS ops_interventions_step_idx
  ON ops_interventions(step_id);
CREATE INDEX IF NOT EXISTS ops_interventions_mission_idx
  ON ops_interventions(mission_id);
CREATE INDEX IF NOT EXISTS ops_interventions_action_run_idx
  ON ops_interventions(action_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS ops_interventions_unresolved_step_unique
  ON ops_interventions(step_id)
  WHERE step_id IS NOT NULL AND status <> 'resolved';

CREATE OR REPLACE FUNCTION update_ops_interventions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ops_interventions_updated_at_trigger ON ops_interventions;
CREATE TRIGGER ops_interventions_updated_at_trigger
  BEFORE UPDATE ON ops_interventions
  FOR EACH ROW
  EXECUTE FUNCTION update_ops_interventions_updated_at();

ALTER TABLE ops_interventions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ops_interventions'
      AND policyname = 'Service role has full access to ops_interventions'
  ) THEN
    CREATE POLICY "Service role has full access to ops_interventions"
      ON ops_interventions
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO ops_policies (key, value, description)
VALUES (
  'alert_thresholds',
  '{
    "missionFailures24h": 3,
    "stepFailureRate24h": 0.4,
    "heartbeatFailures24h": 3
  }'::jsonb,
  'Alert thresholds for runtime monitoring and intervention escalation'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_runtime_health_summary(
  p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '24 hours')
)
RETURNS TABLE(
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  heartbeat_runs BIGINT,
  heartbeat_failures BIGINT,
  latest_heartbeat_run_id UUID,
  steps_succeeded BIGINT,
  steps_failed BIGINT,
  step_failure_rate NUMERIC,
  avg_step_latency_ms NUMERIC,
  unresolved_interventions BIGINT,
  open_interventions BIGINT,
  acknowledged_interventions BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH heartbeat AS (
    SELECT
      COUNT(*)::BIGINT AS runs,
      COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failures,
      (
        ARRAY_AGG(id ORDER BY started_at DESC)
      )[1] AS latest_run_id
    FROM ops_action_runs
    WHERE action = 'heartbeat'
      AND started_at >= p_since
  ),
  step_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'succeeded')::BIGINT AS succeeded,
      COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed,
      AVG(
        EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000
      ) FILTER (
        WHERE completed_at IS NOT NULL
          AND status IN ('succeeded', 'failed')
      ) AS avg_latency_ms
    FROM ops_steps
    WHERE created_at >= p_since
  ),
  intervention_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status <> 'resolved')::BIGINT AS unresolved,
      COUNT(*) FILTER (WHERE status = 'open')::BIGINT AS open_count,
      COUNT(*) FILTER (WHERE status = 'acknowledged')::BIGINT AS acknowledged_count
    FROM ops_interventions
  )
  SELECT
    p_since AS window_start,
    NOW() AS window_end,
    hb.runs AS heartbeat_runs,
    hb.failures AS heartbeat_failures,
    hb.latest_run_id AS latest_heartbeat_run_id,
    ss.succeeded AS steps_succeeded,
    ss.failed AS steps_failed,
    CASE
      WHEN (ss.succeeded + ss.failed) = 0 THEN 0
      ELSE (ss.failed::NUMERIC / (ss.succeeded + ss.failed)::NUMERIC)
    END AS step_failure_rate,
    COALESCE(ss.avg_latency_ms, 0)::NUMERIC AS avg_step_latency_ms,
    isv.unresolved AS unresolved_interventions,
    isv.open_count AS open_interventions,
    isv.acknowledged_count AS acknowledged_interventions
  FROM heartbeat hb
  CROSS JOIN step_stats ss
  CROSS JOIN intervention_stats isv;
$$;
