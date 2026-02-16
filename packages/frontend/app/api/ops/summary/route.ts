import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

interface RuntimeHealthSummaryRow {
  window_start: string;
  window_end: string;
  heartbeat_runs: number;
  heartbeat_failures: number;
  latest_heartbeat_run_id: string | null;
  steps_succeeded: number;
  steps_failed: number;
  step_failure_rate: number;
  avg_step_latency_ms: number;
  unresolved_interventions: number;
  open_interventions: number;
  acknowledged_interventions: number;
}

interface AlertThresholds {
  missionFailures24h: number;
  stepFailureRate24h: number;
  heartbeatFailures24h: number;
}

const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  missionFailures24h: 3,
  stepFailureRate24h: 0.4,
  heartbeatFailures24h: 3,
};

export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [healthResult, thresholdsResult, missionFailureResult] = await Promise.all([
    db.rpc('get_runtime_health_summary', { p_since: since }),
    db
      .from('ops_policies')
      .select('value')
      .eq('key', 'alert_thresholds')
      .single(),
    db
      .from('ops_missions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('completed_at', since),
  ]);

  if (healthResult.error) {
    return NextResponse.json({ error: healthResult.error.message }, { status: 500 });
  }

  const row = Array.isArray(healthResult.data)
    ? (healthResult.data[0] as RuntimeHealthSummaryRow | undefined)
    : (healthResult.data as RuntimeHealthSummaryRow | null);

  if (!row) {
    return NextResponse.json({ error: 'Runtime summary is unavailable' }, { status: 500 });
  }

  const thresholds = parseAlertThresholds(thresholdsResult.data?.value);
  const missionFailures24h = missionFailureResult.count ?? 0;

  const thresholdBreaches = {
    missionFailures24h: missionFailures24h >= thresholds.missionFailures24h,
    stepFailureRate24h: row.step_failure_rate >= thresholds.stepFailureRate24h,
    heartbeatFailures24h: row.heartbeat_failures >= thresholds.heartbeatFailures24h,
  };

  return NextResponse.json({
    windowStart: row.window_start,
    windowEnd: row.window_end,
    heartbeatRuns: row.heartbeat_runs,
    heartbeatFailures: row.heartbeat_failures,
    latestHeartbeatRunId: row.latest_heartbeat_run_id,
    stepsSucceeded: row.steps_succeeded,
    stepsFailed: row.steps_failed,
    stepFailureRate: row.step_failure_rate,
    avgStepLatencyMs: row.avg_step_latency_ms,
    missionFailures24h,
    interventions: {
      unresolved: row.unresolved_interventions,
      open: row.open_interventions,
      acknowledged: row.acknowledged_interventions,
    },
    alertThresholds: thresholds,
    thresholdBreaches,
  });
}

function parseAlertThresholds(value: unknown): AlertThresholds {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_ALERT_THRESHOLDS;
  }

  const v = value as Record<string, unknown>;
  return {
    missionFailures24h: asPositiveNumber(v.missionFailures24h, DEFAULT_ALERT_THRESHOLDS.missionFailures24h),
    stepFailureRate24h: asRatio(v.stepFailureRate24h, DEFAULT_ALERT_THRESHOLDS.stepFailureRate24h),
    heartbeatFailures24h: asPositiveNumber(v.heartbeatFailures24h, DEFAULT_ALERT_THRESHOLDS.heartbeatFailures24h),
  };
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
