-- Pitch activation transaction:
-- Converts a completed pitch session into live runtime config + first mission.

ALTER TABLE IF EXISTS pitch_sessions
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_mission_id UUID;

CREATE OR REPLACE FUNCTION activate_pitch_session(
  p_session_id UUID,
  p_force_replace BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_session RECORD;
  v_agent_config JSONB;
  v_worker_config JSONB;
  v_startup_name TEXT;
  v_runtime_exists BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();

  v_step JSONB;
  v_trigger JSONB;
  v_affinity JSONB;
  v_policy_key TEXT;
  v_policy_value JSONB;
  v_required_config TEXT[];
  v_cap_gate_policy_key TEXT;

  v_agent_a TEXT;
  v_agent_b TEXT;
  v_swap TEXT;
  v_affinity_value NUMERIC;

  v_first_agent_id TEXT;
  v_first_step_kind TEXT;
  v_first_step_description TEXT;
  v_first_step_payload JSONB;
  v_proposal_id UUID;
  v_mission_id UUID;
BEGIN
  SELECT *
  INTO v_session
  FROM pitch_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'session_not_found',
      'message', 'Pitch session not found.'
    );
  END IF;

  IF v_session.status <> 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'session_not_completed',
      'message', 'Pitch session must be completed before activation.'
    );
  END IF;

  v_agent_config := v_session.agent_config;
  v_worker_config := v_session.worker_config;
  v_startup_name := COALESCE(NULLIF(v_session.startup_name, ''), 'AI Startup');

  IF v_agent_config IS NULL OR jsonb_typeof(v_agent_config) <> 'object' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_agent_config',
      'message', 'Pitch session is missing a valid agent configuration.'
    );
  END IF;

  IF v_worker_config IS NULL OR jsonb_typeof(v_worker_config) <> 'object' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'invalid_worker_config',
      'message', 'Pitch session is missing a valid worker configuration.'
    );
  END IF;

  IF jsonb_typeof(COALESCE(v_agent_config->'agents', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(v_agent_config->'agents', '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'no_agents',
      'message', 'Activation requires at least one agent.'
    );
  END IF;

  IF jsonb_typeof(COALESCE(v_worker_config->'stepKinds', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(v_worker_config->'stepKinds', '[]'::jsonb)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'no_step_kinds',
      'message', 'Activation requires at least one step kind.'
    );
  END IF;

  SELECT (
    EXISTS(SELECT 1 FROM ops_step_registry)
    OR EXISTS(SELECT 1 FROM ops_triggers)
    OR EXISTS(SELECT 1 FROM ops_relationships)
    OR EXISTS(
      SELECT 1
      FROM ops_policies
      WHERE key IN (
        'agent_configs',
        'auto_approve',
        'daily_quotas',
        'memory_influence',
        'runtime_control',
        'conversation_schedule'
      )
    )
  )
  INTO v_runtime_exists;

  IF v_runtime_exists AND NOT p_force_replace THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'runtime_exists',
      'message', 'Runtime configuration already exists. Confirmation required to replace.'
    );
  END IF;

  IF v_runtime_exists THEN
    UPDATE ops_steps
    SET
      status = 'failed',
      output = jsonb_build_object(
        'error', 'Step canceled: runtime configuration replaced.',
        'replacedAt', v_now
      ),
      completed_at = COALESCE(completed_at, v_now)
    WHERE status IN ('queued', 'running');

    UPDATE ops_missions
    SET
      status = 'failed',
      completed_at = COALESCE(completed_at, v_now)
    WHERE status IN ('approved', 'running');
  END IF;

  -- Replace single-tenant runtime shape.
  DELETE FROM ops_triggers;
  DELETE FROM ops_step_registry;
  DELETE FROM ops_relationships;

  -- Core policies
  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'agent_configs',
    jsonb_build_object(
      'version', '1.0',
      'startup', v_startup_name,
      'agents', COALESCE(v_agent_config->'agents', '[]'::jsonb),
      'conversationFormats', COALESCE(v_agent_config->'conversationFormats', '[]'::jsonb),
      'dailySchedule', COALESCE(v_agent_config->'dailySchedule', '[]'::jsonb)
    ),
    'Generated from activated pitch session'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'conversation_schedule',
    jsonb_build_object('schedule', COALESCE(v_agent_config->'dailySchedule', '[]'::jsonb)),
    'Conversation cadence generated from pitch session'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'auto_approve',
    COALESCE(v_worker_config#>'{policies,auto_approve}', '{"enabled": false, "allowed_step_kinds": []}'::jsonb),
    'Generated from activated pitch session'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'daily_quotas',
    COALESCE(v_worker_config#>'{policies,daily_quotas}', '{}'::jsonb),
    'Generated from activated pitch session'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'memory_influence',
    COALESCE(v_worker_config#>'{policies,memory_influence}', '{"enabled": true, "probability": 0.3}'::jsonb),
    'Generated from activated pitch session'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'runtime_control',
    jsonb_build_object(
      'mode', 'running',
      'pollingMinutes', 5,
      'updatedAt', v_now
    ),
    'Runtime control state for pause/resume/stop and polling cadence'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  INSERT INTO ops_policies (key, value, description)
  VALUES (
    'company_runtime_config',
    jsonb_build_object(
      'companyTemplate', 'research',
      'metricName', 'Weekly qualified leads',
      'targetValue', 25,
      'deadlineDays', 30,
      'budgetLimit', 100,
      'loopCapPerDay', 24,
      'postLimitPerDay', 5
    ),
    'MVP runtime config for goal, metric, budget, and loop limits'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;

  -- cap_gate_* policies
  FOR v_policy_key, v_policy_value IN
    SELECT key, value FROM jsonb_each(COALESCE(v_worker_config->'capGates', '{}'::jsonb))
  LOOP
    INSERT INTO ops_policies (key, value, description)
    VALUES (
      'cap_gate_' || v_policy_key,
      v_policy_value,
      'Generated cap gate from activated pitch session'
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, description = EXCLUDED.description;
  END LOOP;

  -- Step registry
  FOR v_step IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_worker_config->'stepKinds', '[]'::jsonb))
  LOOP
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(v_step->'requiredConfig') = 'array' THEN v_step->'requiredConfig'
          ELSE '[]'::jsonb
        END
      )
    ) INTO v_required_config;

    v_cap_gate_policy_key := NULLIF(v_step->>'capGatePolicyKey', '');
    IF v_cap_gate_policy_key IS NOT NULL THEN
      v_cap_gate_policy_key := 'cap_gate_' || v_cap_gate_policy_key;
    END IF;

    INSERT INTO ops_step_registry (
      kind,
      display_name,
      worker_type,
      description,
      required_config,
      cap_gate_policy_key
    )
    VALUES (
      COALESCE(NULLIF(v_step->>'kind', ''), 'unknown_step'),
      COALESCE(NULLIF(v_step->>'displayName', ''), COALESCE(v_step->>'kind', 'Unknown Step')),
      COALESCE(NULLIF(v_step->>'workerType', ''), 'generic'),
      COALESCE(NULLIF(v_step->>'description', ''), 'Generated step from activated pitch session'),
      v_required_config,
      v_cap_gate_policy_key
    )
    ON CONFLICT (kind) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      worker_type = EXCLUDED.worker_type,
      description = EXCLUDED.description,
      required_config = EXCLUDED.required_config,
      cap_gate_policy_key = EXCLUDED.cap_gate_policy_key;
  END LOOP;

  -- Triggers
  FOR v_trigger IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_worker_config->'triggers', '[]'::jsonb))
  LOOP
    INSERT INTO ops_triggers (
      name,
      event_pattern,
      condition,
      proposal_template,
      cooldown_minutes,
      is_active,
      last_fired_at,
      fire_count
    )
    VALUES (
      COALESCE(NULLIF(v_trigger->>'name', ''), 'trigger_' || substr(gen_random_uuid()::text, 1, 8)),
      COALESCE(NULLIF(v_trigger->>'eventPattern', ''), '*'),
      COALESCE(v_trigger->'condition', '{}'::jsonb),
      COALESCE(
        v_trigger->'proposalTemplate',
        jsonb_build_object('title', 'Auto proposal', 'steps', '[]'::jsonb)
      ),
      CASE
        WHEN COALESCE(v_trigger->>'cooldownMinutes', '') ~ '^\d+$'
          THEN (v_trigger->>'cooldownMinutes')::INTEGER
        ELSE 60
      END,
      CASE LOWER(COALESCE(v_trigger->>'isActive', 'true'))
        WHEN 'true' THEN TRUE
        WHEN 'false' THEN FALSE
        ELSE TRUE
      END,
      NULL,
      0
    );
  END LOOP;

  -- Initial relationships
  FOR v_affinity IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_agent_config->'initialAffinities', '[]'::jsonb))
  LOOP
    v_agent_a := NULLIF(v_affinity->>'agentA', '');
    v_agent_b := NULLIF(v_affinity->>'agentB', '');

    IF v_agent_a IS NULL OR v_agent_b IS NULL OR v_agent_a = v_agent_b THEN
      CONTINUE;
    END IF;

    IF v_agent_a > v_agent_b THEN
      v_swap := v_agent_a;
      v_agent_a := v_agent_b;
      v_agent_b := v_swap;
    END IF;

    v_affinity_value := CASE
      WHEN COALESCE(v_affinity->>'affinity', '') ~ '^-?\d+(\.\d+)?$'
        THEN (v_affinity->>'affinity')::NUMERIC
      ELSE 0.5
    END;

    INSERT INTO ops_relationships (
      agent_a,
      agent_b,
      affinity,
      total_interactions,
      positive_interactions,
      negative_interactions,
      drift_log,
      updated_at
    )
    VALUES (
      v_agent_a,
      v_agent_b,
      v_affinity_value,
      0,
      0,
      0,
      '[]'::jsonb,
      v_now
    )
    ON CONFLICT (agent_a, agent_b) DO UPDATE
    SET
      affinity = EXCLUDED.affinity,
      updated_at = EXCLUDED.updated_at;
  END LOOP;

  -- Bootstrap first mission
  v_first_agent_id := COALESCE(NULLIF(v_agent_config#>>'{agents,0,id}', ''), 'system');
  v_first_step_kind := COALESCE(NULLIF(v_worker_config#>>'{stepKinds,0,kind}', ''), 'manual_review');
  v_first_step_description := COALESCE(
    NULLIF(v_worker_config#>>'{stepKinds,0,description}', ''),
    'Execute initial activation mission'
  );

  v_first_step_payload := jsonb_build_object(
    'description', v_first_step_description,
    'startup', v_startup_name,
    'source', 'activation_bootstrap',
    'sessionId', p_session_id
  );

  INSERT INTO ops_proposals (
    agent_id,
    title,
    description,
    proposed_steps,
    source,
    source_trace_id,
    status,
    decided_at
  )
  VALUES (
    v_first_agent_id,
    'Bootstrap first mission',
    'Initial mission created during startup activation.',
    jsonb_build_array(
      jsonb_build_object('kind', v_first_step_kind, 'description', v_first_step_description)
    ),
    'manual',
    'activation:' || p_session_id::text,
    'accepted',
    v_now
  )
  RETURNING id INTO v_proposal_id;

  INSERT INTO ops_missions (
    proposal_id,
    title,
    description,
    status,
    created_by
  )
  VALUES (
    v_proposal_id,
    'First mission: launch operating loop',
    'Bootstrapped mission generated from pitch activation.',
    'approved',
    v_first_agent_id
  )
  RETURNING id INTO v_mission_id;

  INSERT INTO ops_steps (
    mission_id,
    step_number,
    kind,
    status,
    payload
  )
  VALUES (
    v_mission_id,
    1,
    v_first_step_kind,
    'queued',
    v_first_step_payload
  );

  INSERT INTO ops_events (
    agent_id,
    kind,
    title,
    summary,
    payload,
    visibility
  )
  VALUES (
    'system',
    'system.activation',
    'Startup activated',
    'Pitch session activated into runtime configuration.',
    jsonb_build_object(
      'sessionId', p_session_id,
      'startupName', v_startup_name,
      'missionId', v_mission_id,
      'replacedExisting', v_runtime_exists
    ),
    'internal'
  );

  UPDATE pitch_sessions
  SET
    activated_at = v_now,
    activation_mission_id = v_mission_id
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'activated',
    'message', 'Startup activated successfully.',
    'sessionId', p_session_id,
    'missionId', v_mission_id,
    'replacedExisting', v_runtime_exists,
    'activatedAt', v_now
  );
END;
$$;
