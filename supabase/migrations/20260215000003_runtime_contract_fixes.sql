-- Runtime contract fixes for heartbeat, memory promotion, and agent eligibility RPCs

-- Standardize ops_action_runs status behavior for in-flight inserts.
ALTER TABLE IF EXISTS ops_action_runs
  ALTER COLUMN status SET DEFAULT 'running';

UPDATE ops_action_runs
SET status = 'running'
WHERE status IS NULL
   OR status NOT IN ('running', 'succeeded', 'failed');

-- Engine heartbeat RPC dependency:
-- Returns one row per configured agent with high-confidence memory counts.
CREATE OR REPLACE FUNCTION get_agents_with_memory_stats()
RETURNS TABLE(agent_id TEXT, high_conf_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  WITH policy AS (
    SELECT value
    FROM ops_policies
    WHERE key = 'agent_configs'
    LIMIT 1
  ),
  raw_agents AS (
    SELECT
      CASE
        WHEN jsonb_typeof(value) = 'array' THEN value
        WHEN jsonb_typeof(value) = 'object' THEN COALESCE(value->'agents', '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS agents
    FROM policy
  ),
  configured_agents AS (
    SELECT DISTINCT elem->>'id' AS agent_id
    FROM raw_agents
    CROSS JOIN LATERAL jsonb_array_elements(agents) AS elem
    WHERE COALESCE(elem->>'id', '') <> ''
  )
  SELECT
    a.agent_id,
    COUNT(m.id) FILTER (
      WHERE m.superseded_by IS NULL
        AND m.confidence >= 0.6
    )::BIGINT AS high_conf_count
  FROM configured_agents a
  LEFT JOIN ops_memories m
    ON m.agent_id = a.agent_id
  GROUP BY a.agent_id
  ORDER BY a.agent_id;
$$;

-- MemoryStore RPC dependency:
-- Finds memories corroborated across at least two distinct agents.
CREATE OR REPLACE FUNCTION find_corroborated_memories()
RETURNS TABLE(id UUID, confidence NUMERIC)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT
      m.id,
      m.confidence,
      m.agent_id,
      LOWER(REGEXP_REPLACE(TRIM(m.content), '\s+', ' ', 'g')) AS normalized_content
    FROM ops_memories m
    WHERE m.superseded_by IS NULL
      AND m.content IS NOT NULL
      AND TRIM(m.content) <> ''
  ),
  corroborated_keys AS (
    SELECT normalized_content
    FROM normalized
    GROUP BY normalized_content
    HAVING COUNT(DISTINCT agent_id) >= 2
  )
  SELECT
    n.id,
    n.confidence
  FROM normalized n
  INNER JOIN corroborated_keys ck
    ON ck.normalized_content = n.normalized_content
  WHERE n.confidence < 1.0;
$$;
