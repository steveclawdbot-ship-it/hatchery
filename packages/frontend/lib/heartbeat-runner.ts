import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSkipReason,
  hasReachedBudgetCap,
  hasReachedLoopCap as evaluateLoopCap,
} from '@/lib/heartbeat/decision';

interface RuntimeConfig {
  companyTemplate: 'research' | 'back-office' | 'creative';
  metricName: string;
  targetValue: number;
  deadlineDays: number;
  budgetLimit: number;
  loopCapPerDay: number;
  postLimitPerDay: number;
}

interface AlertThresholds {
  missionFailures24h: number;
  stepFailureRate24h: number;
  heartbeatFailures24h: number;
}

interface StepRecord {
  id: string;
  mission_id: string;
  step_number: number;
  kind: string;
  payload: unknown;
  created_at: string;
}

interface StepExecutionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface HeartbeatRunResult {
  runId: string;
  stepsRecovered: number;
  stepsExecuted: number;
  stepsFailed: number;
  skipped: boolean;
  reason?: string;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  companyTemplate: 'research',
  metricName: 'Weekly qualified leads',
  targetValue: 25,
  deadlineDays: 30,
  budgetLimit: 100,
  loopCapPerDay: 24,
  postLimitPerDay: 5,
};

const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  missionFailures24h: 3,
  stepFailureRate24h: 0.4,
  heartbeatFailures24h: 3,
};

const MAX_STEPS_PER_TICK = 3;
const MAX_STEP_RETRIES = 2;

export async function runHeartbeatCycle(
  db: SupabaseClient,
  options?: { bypassCaps?: boolean; source?: string },
): Promise<HeartbeatRunResult> {
  const bypassCaps = options?.bypassCaps === true;
  const source = options?.source ?? 'heartbeat';

  const { data: run, error: runError } = await db
    .from('ops_action_runs')
    .insert({ action: 'heartbeat', status: 'running' })
    .select('id')
    .single();

  if (runError || !run) {
    throw new Error(`Failed to create heartbeat run: ${runError?.message ?? 'unknown error'}`);
  }

  try {
    const stepsRecovered = await recoverStuckSteps(db);
    const config = await loadRuntimeConfig(db);
    const alertThresholds = await loadAlertThresholds(db);
    const loopCapReached = await hasReachedLoopCap(db, config.loopCapPerDay);
    if (loopCapReached && !bypassCaps) {
      await emitEvent(
        db,
        'system.loop_cap_reached',
        'Loop cap reached',
        {
          loopCapPerDay: config.loopCapPerDay,
          runId: run.id,
          source,
        },
      );

      await completeRun(db, run.id, {
        status: 'succeeded',
        details: {
          skipped: true,
          reason: 'loop_cap_reached',
          stepsRecovered,
          stepsExecuted: 0,
          stepsFailed: 0,
        },
      });

      return {
        runId: run.id,
        stepsRecovered,
        stepsExecuted: 0,
        stepsFailed: 0,
        skipped: true,
        reason: 'loop_cap_reached',
      };
    }

    const budgetState = await getBudgetState(db, config.budgetLimit);
    if (budgetState.reached && !bypassCaps) {
      await emitEvent(
        db,
        'system.budget_cap_reached',
        'Budget cap reached',
        {
          budgetLimit: config.budgetLimit,
          estimatedSpendUsd: budgetState.estimatedSpendUsd,
          runId: run.id,
          source,
        },
      );

      await completeRun(db, run.id, {
        status: 'succeeded',
        details: {
          skipped: true,
          reason: 'budget_cap_reached',
          estimatedSpendUsd: budgetState.estimatedSpendUsd,
          stepsRecovered,
          stepsExecuted: 0,
          stepsFailed: 0,
        },
      });

      return {
        runId: run.id,
        stepsRecovered,
        stepsExecuted: 0,
        stepsFailed: 0,
        skipped: true,
        reason: 'budget_cap_reached',
      };
    }

    const pending = await loadPendingSteps(db);
    const pendingSkipReason = getSkipReason({
      loopCapReached: false,
      budgetCapReached: false,
      pendingStepCount: pending.length,
    });
    if (pendingSkipReason === 'no_pending_steps') {
      await completeRun(db, run.id, {
        status: 'succeeded',
        details: {
          skipped: true,
          reason: pendingSkipReason,
          stepsRecovered,
          stepsExecuted: 0,
          stepsFailed: 0,
        },
      });

      return {
        runId: run.id,
        stepsRecovered,
        stepsExecuted: 0,
        stepsFailed: 0,
        skipped: true,
        reason: pendingSkipReason,
      };
    }

    const activeMissionId = pending[0].mission_id;
    const batch = pending
      .filter((step) => step.mission_id === activeMissionId)
      .slice(0, MAX_STEPS_PER_TICK);

    let stepsExecuted = 0;
    let stepsFailed = 0;

    for (const step of batch) {
      const claimed = await claimStep(db, step.id);
      if (!claimed) continue;

      await db
        .from('ops_missions')
        .update({ status: 'running' })
        .eq('id', step.mission_id)
        .eq('status', 'approved');

      const result = await runStepWithRetries(db, step, config);
      if (result.success) {
        await completeStep(db, step.id, 'succeeded', result.output ?? {});
        stepsExecuted++;
        await emitEvent(
          db,
          'step.succeeded',
          `Step succeeded: ${step.kind}`,
          {
            stepId: step.id,
            kind: step.kind,
            missionId: step.mission_id,
            runId: run.id,
            output: result.output ?? {},
          },
        );
        continue;
      }

      stepsFailed++;
      await completeStep(db, step.id, 'failed', {
        error: result.error ?? 'Unknown step failure',
        retryLimit: MAX_STEP_RETRIES,
      });
      await emitEvent(
        db,
        'step.failed',
        `Step failed: ${step.kind}`,
        {
          stepId: step.id,
          kind: step.kind,
          missionId: step.mission_id,
          runId: run.id,
          error: result.error ?? 'Unknown step failure',
        },
      );
      try {
        await createStepFailureIntervention(db, {
          runId: run.id,
          stepId: step.id,
          missionId: step.mission_id,
          kind: step.kind,
          error: result.error ?? 'Unknown step failure',
        });
      } catch {
        // Do not fail heartbeat if intervention queue write fails.
      }
    }

    const recentMissionFailures = await countRecentMissionFailures(db);
    if (recentMissionFailures >= alertThresholds.missionFailures24h) {
      await emitEvent(
        db,
        'system.alert',
        'Multiple mission failures detected',
        {
          recentMissionFailures,
          threshold: alertThresholds.missionFailures24h,
          runId: run.id,
          recommendation: 'Switch to manual intervention mode for this company.',
        },
      );
      try {
        await createEscalationIntervention(db, {
          runId: run.id,
          title: 'Mission failure threshold exceeded',
          description: `Mission failures in last 24h: ${recentMissionFailures} (threshold ${alertThresholds.missionFailures24h}).`,
          context: {
            recentMissionFailures,
            missionFailureThreshold24h: alertThresholds.missionFailures24h,
          },
        });
      } catch {
        // Do not fail heartbeat if intervention queue write fails.
      }
    }

    const failureRate24h = await getStepFailureRate24h(db);
    if (failureRate24h >= alertThresholds.stepFailureRate24h) {
      await emitEvent(
        db,
        'system.alert',
        'Step failure rate threshold exceeded',
        {
          runId: run.id,
          failureRate24h,
          threshold: alertThresholds.stepFailureRate24h,
        },
      );
      try {
        await createEscalationIntervention(db, {
          runId: run.id,
          title: 'Step failure rate threshold exceeded',
          description: `Step failure rate in last 24h: ${(failureRate24h * 100).toFixed(1)}% (threshold ${(alertThresholds.stepFailureRate24h * 100).toFixed(1)}%).`,
          context: {
            failureRate24h,
            stepFailureRateThreshold24h: alertThresholds.stepFailureRate24h,
          },
        });
      } catch {
        // Do not fail heartbeat if intervention queue write fails.
      }
    }

    const heartbeatFailures24h = await countHeartbeatFailures24h(db);
    if (heartbeatFailures24h >= alertThresholds.heartbeatFailures24h) {
      await emitEvent(
        db,
        'system.alert',
        'Heartbeat failure threshold exceeded',
        {
          runId: run.id,
          heartbeatFailures24h,
          threshold: alertThresholds.heartbeatFailures24h,
        },
      );
      try {
        await createEscalationIntervention(db, {
          runId: run.id,
          title: 'Heartbeat failure threshold exceeded',
          description: `Heartbeat failures in last 24h: ${heartbeatFailures24h} (threshold ${alertThresholds.heartbeatFailures24h}).`,
          context: {
            heartbeatFailures24h,
            heartbeatFailureThreshold24h: alertThresholds.heartbeatFailures24h,
          },
        });
      } catch {
        // Do not fail heartbeat if intervention queue write fails.
      }
    }

    await emitEvent(
      db,
      'system.heartbeat',
      'Heartbeat',
        {
          runId: run.id,
          source,
          stepsRecovered,
          stepsExecuted,
          stepsFailed,
          missionId: activeMissionId,
      },
    );

    await completeRun(db, run.id, {
      status: 'succeeded',
      details: {
        skipped: false,
        stepsRecovered,
        stepsExecuted,
        stepsFailed,
        missionId: activeMissionId,
        estimatedSpendUsd: budgetState.estimatedSpendUsd,
        bypassCaps,
        source,
      },
    });

    return {
      runId: run.id,
      stepsRecovered,
      stepsExecuted,
      stepsFailed,
      skipped: false,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    try {
      await createEscalationIntervention(db, {
        runId: run.id,
        title: 'Heartbeat run failed',
        description: errorMessage,
        context: {
          error: errorMessage,
        },
      });
    } catch {
      // Preserve original failure path if intervention insertion fails.
    }

    await completeRun(db, run.id, {
      status: 'failed',
      details: { error: errorMessage },
    });

    throw err;
  }
}

async function recoverStuckSteps(db: SupabaseClient): Promise<number> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuck, error } = await db
    .from('ops_steps')
    .select('id')
    .eq('status', 'running')
    .lt('reserved_at', thirtyMinAgo);

  if (error) {
    throw new Error(`Failed to check stuck steps: ${error.message}`);
  }

  if (!stuck?.length) return 0;

  const { error: recoverError } = await db
    .from('ops_steps')
    .update({ status: 'queued', reserved_by: null, reserved_at: null })
    .in('id', stuck.map((step) => step.id));

  if (recoverError) {
    throw new Error(`Failed to recover stuck steps: ${recoverError.message}`);
  }

  return stuck.length;
}

async function loadRuntimeConfig(db: SupabaseClient): Promise<RuntimeConfig> {
  const { data, error } = await db
    .from('ops_policies')
    .select('value')
    .eq('key', 'company_runtime_config')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load runtime config: ${error.message}`);
  }

  const value = data?.value;
  if (!value || !isRecord(value)) return DEFAULT_RUNTIME_CONFIG;

  return {
    companyTemplate: parseTemplate(value.companyTemplate),
    metricName: parseMetricName(value.metricName),
    targetValue: asPositiveNumber(value.targetValue, DEFAULT_RUNTIME_CONFIG.targetValue),
    deadlineDays: asPositiveNumber(value.deadlineDays, DEFAULT_RUNTIME_CONFIG.deadlineDays),
    budgetLimit: asPositiveNumber(value.budgetLimit, DEFAULT_RUNTIME_CONFIG.budgetLimit),
    loopCapPerDay: asPositiveNumber(value.loopCapPerDay, DEFAULT_RUNTIME_CONFIG.loopCapPerDay),
    postLimitPerDay: asPositiveNumber(value.postLimitPerDay, DEFAULT_RUNTIME_CONFIG.postLimitPerDay),
  };
}

async function loadAlertThresholds(db: SupabaseClient): Promise<AlertThresholds> {
  const { data, error } = await db
    .from('ops_policies')
    .select('value')
    .eq('key', 'alert_thresholds')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load alert thresholds: ${error.message}`);
  }

  const value = data?.value;
  if (!value || !isRecord(value)) return DEFAULT_ALERT_THRESHOLDS;

  return {
    missionFailures24h: asPositiveNumber(
      value.missionFailures24h,
      DEFAULT_ALERT_THRESHOLDS.missionFailures24h,
    ),
    stepFailureRate24h: asRatio(
      value.stepFailureRate24h,
      DEFAULT_ALERT_THRESHOLDS.stepFailureRate24h,
    ),
    heartbeatFailures24h: asPositiveNumber(
      value.heartbeatFailures24h,
      DEFAULT_ALERT_THRESHOLDS.heartbeatFailures24h,
    ),
  };
}

async function hasReachedLoopCap(db: SupabaseClient, loopCapPerDay: number): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await db
    .from('ops_action_runs')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'heartbeat')
    .eq('status', 'succeeded')
    .gte('started_at', todayStart.toISOString());

  if (error) {
    throw new Error(`Failed to evaluate loop cap: ${error.message}`);
  }

  return evaluateLoopCap(count ?? 0, loopCapPerDay);
}

async function loadPendingSteps(db: SupabaseClient): Promise<StepRecord[]> {
  const { data, error } = await db
    .from('ops_steps')
    .select('id, mission_id, step_number, kind, payload, created_at')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(`Failed to load queued steps: ${error.message}`);
  }

  return (data as StepRecord[] | null) ?? [];
}

async function claimStep(db: SupabaseClient, stepId: string): Promise<boolean> {
  const { data, error } = await db.rpc('claim_step', {
    p_step_id: stepId,
    p_worker_id: 'heartbeat-runner',
  });
  if (error) {
    throw new Error(`Failed to claim step ${stepId}: ${error.message}`);
  }
  return Boolean(data);
}

async function completeStep(
  db: SupabaseClient,
  stepId: string,
  status: 'succeeded' | 'failed',
  output: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.rpc('complete_step', {
    p_step_id: stepId,
    p_status: status,
    p_output: output,
  });
  if (error) {
    throw new Error(`Failed to complete step ${stepId}: ${error.message}`);
  }
}

async function runStepWithRetries(
  db: SupabaseClient,
  step: StepRecord,
  config: RuntimeConfig,
): Promise<StepExecutionResult> {
  let lastError = 'Unknown step failure';

  for (let attempt = 1; attempt <= MAX_STEP_RETRIES + 1; attempt++) {
    const result = await executeStep(db, step, config);
    if (result.success) {
      return {
        success: true,
        output: {
          ...(result.output ?? {}),
          attempts: attempt,
        },
      };
    }

    lastError = result.error ?? lastError;

    if (attempt <= MAX_STEP_RETRIES) {
      await emitEvent(
        db,
        'step.retry',
        `Retrying step: ${step.kind}`,
        {
          stepId: step.id,
          kind: step.kind,
          missionId: step.mission_id,
          attempt,
          retryLimit: MAX_STEP_RETRIES,
          error: lastError,
        },
      );
    }
  }

  return { success: false, error: lastError };
}

async function executeStep(
  db: SupabaseClient,
  step: StepRecord,
  config: RuntimeConfig,
): Promise<StepExecutionResult> {
  const payload = asRecord(step.payload);

  switch (step.kind) {
    case 'research':
      return executeResearchStep(payload);
    case 'draft':
      return executeDraftStep(payload);
    case 'review':
      return executeReviewStep(payload);
    case 'publish_x':
      return executePublishXStep(db, payload, config);
    case 'analyze_results':
      return executeAnalyzeResultsStep(db, payload);
    default:
      return executeGenericStep(step.kind, payload);
  }
}

function executeResearchStep(payload: Record<string, unknown>): StepExecutionResult {
  const topic = readString(payload.topic)
    ?? readString(payload.description)
    ?? 'market and user research';

  return {
    success: true,
    output: {
      topic,
      summary: `Research completed for "${topic}".`,
      keyFindings: [
        'Audience segments identified',
        'Priority demand signals captured',
        'Three immediate opportunities proposed',
      ],
      confidence: 0.7,
      estimatedCostUsd: 0.15,
    },
  };
}

function executeDraftStep(payload: Record<string, unknown>): StepExecutionResult {
  const brief = readString(payload.brief)
    ?? readString(payload.description)
    ?? readString(payload.topic);
  if (!brief) {
    return { success: false, error: 'Draft step requires a brief, description, or topic.' };
  }

  return {
    success: true,
    output: {
      brief,
      draft: `Draft generated for: ${brief}`,
      charCount: `Draft generated for: ${brief}`.length,
      estimatedCostUsd: 0.2,
    },
  };
}

function executeReviewStep(payload: Record<string, unknown>): StepExecutionResult {
  const text = readString(payload.text)
    ?? readString(payload.content)
    ?? readString(payload.draft);
  if (!text) {
    return { success: false, error: 'Review step requires text, content, or draft payload.' };
  }

  const blockedReason = detectBlockedContent(text);
  const tooShort = text.trim().length < 40;
  const approved = !blockedReason && !tooShort;
  const issues: string[] = [];
  if (blockedReason) issues.push(`blocked_content:${blockedReason}`);
  if (tooShort) issues.push('draft_too_short');

  return {
    success: true,
    output: {
      approved,
      issues,
      recommendation: approved
        ? 'Ready to publish.'
        : 'Revise content before publish.',
      estimatedCostUsd: 0.1,
    },
  };
}

async function executePublishXStep(
  db: SupabaseClient,
  payload: Record<string, unknown>,
  config: RuntimeConfig,
): Promise<StepExecutionResult> {
  const baseText = readString(payload.text)
    ?? readString(payload.draft)
    ?? readString(payload.content);
  if (!baseText) {
    return { success: false, error: 'publish_x requires text, draft, or content.' };
  }

  let textForPublish = baseText;
  const blockedReason = detectBlockedContent(textForPublish);
  if (blockedReason) {
    textForPublish = rewriteUnsafeContent(textForPublish);
    const stillBlocked = detectBlockedContent(textForPublish);
    if (stillBlocked) {
      return {
        success: false,
        error: `Content blocked by safety filter (${stillBlocked}) after rewrite.`,
      };
    }
  }

  const imageUrl = readString(payload.imageUrl) ?? readString(payload.image_url);
  if (imageUrl) {
    return {
      success: false,
      error: 'Image posting is not supported in MVP v1. Use manual intervention.',
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count, error: countError } = await db
    .from('ops_events')
    .select('*', { count: 'exact', head: true })
    .eq('kind', 'integration.x.posted')
    .gte('created_at', todayStart.toISOString());
  if (countError) {
    return { success: false, error: `Failed to enforce post cap: ${countError.message}` };
  }
  if ((count ?? 0) >= config.postLimitPerDay) {
    return {
      success: false,
      error: `Post cap reached (${count}/${config.postLimitPerDay}) for today.`,
    };
  }

  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    return {
      success: false,
      error: 'TWITTER_BEARER_TOKEN is not configured.',
    };
  }

  const link = readString(payload.url) ?? readString(payload.link);
  let text = textForPublish.trim();
  if (link) text = `${text} ${link}`.trim();
  if (text.length > 280) text = `${text.slice(0, 277)}...`;

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    return {
      success: false,
      error: `X publish failed (${response.status}): ${await response.text()}`,
    };
  }

  const json = (await response.json()) as { data?: { id?: string } };
  const postId = json.data?.id ?? 'unknown';

  await emitEvent(
    db,
    'integration.x.posted',
    'Posted to X',
    {
      postId,
      text,
    },
  );

  return {
    success: true,
    output: {
      postId,
      text,
      platform: 'x',
      postedAt: new Date().toISOString(),
      estimatedCostUsd: 0.05,
    },
  };
}

async function executeAnalyzeResultsStep(
  db: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<StepExecutionResult> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: succeededToday, error: succeededError } = await db
    .from('ops_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'succeeded')
    .gte('completed_at', todayStart.toISOString());
  if (succeededError) {
    return {
      success: false,
      error: `Failed to collect success stats: ${succeededError.message}`,
    };
  }

  const { count: failedToday, error: failedError } = await db
    .from('ops_steps')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('completed_at', todayStart.toISOString());
  if (failedError) {
    return {
      success: false,
      error: `Failed to collect failure stats: ${failedError.message}`,
    };
  }

  const success = succeededToday ?? 0;
  const failed = failedToday ?? 0;
  const total = success + failed;
  const successRate = total === 0 ? 0 : success / total;

  return {
    success: true,
    output: {
      metricName: readString(payload.metricName) ?? 'step_success_rate',
      successStepsToday: success,
      failedStepsToday: failed,
      successRate,
      summary: successRate >= 0.7
        ? 'Execution performance is on track.'
        : 'Execution quality needs intervention.',
      estimatedCostUsd: 0.1,
    },
  };
}

function executeGenericStep(
  kind: string,
  payload: Record<string, unknown>,
): StepExecutionResult {
  return {
    success: true,
    output: {
      kind,
      handledBy: 'generic_executor',
      note: 'No specialized handler found. Generic execution path used.',
      payloadEcho: payload,
      estimatedCostUsd: 0.05,
    },
  };
}

async function getBudgetState(
  db: SupabaseClient,
  budgetLimit: number,
): Promise<{ reached: boolean; estimatedSpendUsd: number }> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from('ops_steps')
    .select('output')
    .eq('status', 'succeeded')
    .gte('completed_at', todayStart.toISOString());

  if (error) {
    throw new Error(`Failed to evaluate budget cap: ${error.message}`);
  }

  const rows = (data as Array<{ output: unknown }> | null) ?? [];
  let estimatedSpendUsd = 0;

  for (const row of rows) {
    if (!isRecord(row.output)) continue;
    const cost = Number(row.output.estimatedCostUsd);
    if (!Number.isFinite(cost) || cost <= 0) continue;
    estimatedSpendUsd += cost;
  }

  const rounded = Number(estimatedSpendUsd.toFixed(4));

  return {
    reached: hasReachedBudgetCap(rounded, budgetLimit),
    estimatedSpendUsd: rounded,
  };
}

async function countRecentMissionFailures(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from('ops_missions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('completed_at', since);

  if (error) {
    throw new Error(`Failed to count mission failures: ${error.message}`);
  }

  return count ?? 0;
}

async function getStepFailureRate24h(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: failed, error: failedError }, { count: succeeded, error: succeededError }] =
    await Promise.all([
      db
        .from('ops_steps')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('completed_at', since),
      db
        .from('ops_steps')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'succeeded')
        .gte('completed_at', since),
    ]);

  if (failedError) {
    throw new Error(`Failed to count failed steps: ${failedError.message}`);
  }
  if (succeededError) {
    throw new Error(`Failed to count succeeded steps: ${succeededError.message}`);
  }

  const failedCount = failed ?? 0;
  const succeededCount = succeeded ?? 0;
  const total = failedCount + succeededCount;
  if (total === 0) return 0;
  return failedCount / total;
}

async function countHeartbeatFailures24h(db: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await db
    .from('ops_action_runs')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'heartbeat')
    .eq('status', 'failed')
    .gte('started_at', since);

  if (error) {
    throw new Error(`Failed to count heartbeat failures: ${error.message}`);
  }

  return count ?? 0;
}

async function createStepFailureIntervention(
  db: SupabaseClient,
  params: {
    runId: string;
    stepId: string;
    missionId: string;
    kind: string;
    error: string;
  },
): Promise<void> {
  const existing = await db
    .from('ops_interventions')
    .select('id')
    .eq('step_id', params.stepId)
    .neq('status', 'resolved')
    .limit(1);

  if (!existing.error && existing.data && existing.data.length > 0) {
    return;
  }

  const classification = classifyIntervention(params.error);
  await db.from('ops_interventions').insert({
    status: 'open',
    reason: classification.reason,
    severity: classification.severity,
    title: `${classification.title}: ${params.kind}`,
    description: params.error,
    step_id: params.stepId,
    mission_id: params.missionId,
    action_run_id: params.runId,
    context: {
      kind: params.kind,
      error: params.error,
    },
  });
}

async function createEscalationIntervention(
  db: SupabaseClient,
  params: {
    runId: string;
    title: string;
    description: string;
    context: Record<string, unknown>;
  },
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const existing = await db
    .from('ops_interventions')
    .select('id')
    .eq('reason', 'escalation')
    .eq('title', params.title)
    .neq('status', 'resolved')
    .gte('created_at', oneHourAgo)
    .limit(1);

  if (!existing.error && existing.data && existing.data.length > 0) {
    return;
  }

  const { error } = await db.from('ops_interventions').insert({
    status: 'open',
    reason: 'escalation',
    severity: 'critical',
    title: params.title,
    description: params.description,
    action_run_id: params.runId,
    context: params.context,
  });

  if (error && !isLikelyDuplicateError(error.message)) {
    throw new Error(`Failed to create escalation intervention: ${error.message}`);
  }
}

function classifyIntervention(errorMessage: string): {
  reason: string;
  severity: 'medium' | 'high';
  title: string;
} {
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes('safety filter') || normalized.includes('blocked')) {
    return {
      reason: 'safety_blocked',
      severity: 'high',
      title: 'Safety block requires review',
    };
  }
  if (normalized.includes('not configured') || normalized.includes('not supported')) {
    return {
      reason: 'integration_blocked',
      severity: 'medium',
      title: 'Integration configuration required',
    };
  }
  if (normalized.includes('cap reached') || normalized.includes('quota')) {
    return {
      reason: 'quota_blocked',
      severity: 'medium',
      title: 'Quota or cap blocked execution',
    };
  }
  return {
    reason: 'step_failed',
    severity: 'high',
    title: 'Step execution failed',
  };
}

function isLikelyDuplicateError(message: string): boolean {
  const lowered = message.toLowerCase();
  return lowered.includes('duplicate key') || lowered.includes('already exists');
}

async function completeRun(
  db: SupabaseClient,
  runId: string,
  params: {
    status: 'succeeded' | 'failed';
    details: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db
    .from('ops_action_runs')
    .update({
      status: params.status,
      completed_at: new Date().toISOString(),
      details: params.details,
    })
    .eq('id', runId);

  if (error) {
    throw new Error(`Failed to complete heartbeat run: ${error.message}`);
  }
}

async function emitEvent(
  db: SupabaseClient,
  kind: string,
  title: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('ops_events').insert({
    agent_id: 'system',
    kind,
    title,
    payload,
    visibility: 'internal',
  });

  if (error) {
    throw new Error(`Failed to emit event ${kind}: ${error.message}`);
  }
}

function parseTemplate(value: unknown): RuntimeConfig['companyTemplate'] {
  if (value === 'research' || value === 'back-office' || value === 'creative') {
    return value;
  }
  return DEFAULT_RUNTIME_CONFIG.companyTemplate;
}

function parseMetricName(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return DEFAULT_RUNTIME_CONFIG.metricName;
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function asRatio(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) return fallback;
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function detectBlockedContent(text: string): string | null {
  const normalized = text.toLowerCase();
  const blockedSignals = [
    'porn',
    'adult',
    'hate',
    'harass',
    'casino',
    'gambling',
    'racist',
    'racial slur',
    'political campaign',
    'election fraud',
  ];
  const match = blockedSignals.find((signal) => normalized.includes(signal));
  return match ?? null;
}

function rewriteUnsafeContent(text: string): string {
  let rewritten = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bporn(ography)?\b/gi, '[redacted-topic]'],
    [/\badult\b/gi, '[redacted-topic]'],
    [/\bhate\b/gi, 'harmful'],
    [/\bharass(ment)?\b/gi, 'abusive conduct'],
    [/\bcasino\b/gi, '[restricted-topic]'],
    [/\bgambling\b/gi, '[restricted-topic]'],
    [/\bracist\b/gi, '[redacted-term]'],
    [/\bracial slur\b/gi, '[redacted-term]'],
    [/\bpolitical campaign\b/gi, '[restricted-topic]'],
    [/\belection fraud\b/gi, '[restricted-topic]'],
  ];

  for (const [pattern, replacement] of replacements) {
    rewritten = rewritten.replace(pattern, replacement);
  }

  return rewritten;
}
