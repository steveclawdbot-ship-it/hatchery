import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runHeartbeatCycle } from '@/lib/heartbeat-runner';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type RuntimeMode = 'running' | 'paused' | 'stopped';
type ControlAction = 'run_now' | 'pause' | 'resume' | 'stop_all';

interface RuntimeControlPolicy {
  mode: RuntimeMode;
  pollingMinutes: number;
  updatedAt: string;
}

const DEFAULT_CONTROL: RuntimeControlPolicy = {
  mode: 'running',
  pollingMinutes: 5,
  updatedAt: new Date(0).toISOString(),
};

export async function POST(request: Request) {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const action = parseAction(body);
  if (!action) {
    return NextResponse.json({ error: 'Invalid control action' }, { status: 400 });
  }

  let control: RuntimeControlPolicy;
  try {
    control = await loadRuntimeControl(db);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }

  if (action === 'run_now') {
    if (control.mode !== 'running') {
      return NextResponse.json(
        { error: `Cannot run heartbeat while runtime is ${control.mode}. Resume first.` },
        { status: 409 },
      );
    }

    try {
      const result = await runHeartbeatCycle(db);
      return NextResponse.json({
        ok: true,
        message: result.skipped
          ? `Heartbeat skipped (${result.reason ?? 'no-op'}).`
          : `Heartbeat completed: ${result.stepsExecuted} succeeded, ${result.stepsFailed} failed, ${result.stepsRecovered} recovered.`,
        result,
        control: toPublicControl(control),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  const nextMode = action === 'pause'
    ? 'paused'
    : action === 'resume'
      ? 'running'
      : 'stopped';

  const updatedControl: RuntimeControlPolicy = {
    mode: nextMode,
    pollingMinutes: control.pollingMinutes,
    updatedAt: new Date().toISOString(),
  };

  const saveError = await saveRuntimeControl(db, updatedControl);
  if (saveError) {
    return NextResponse.json({ error: saveError }, { status: 500 });
  }

  let terminatedSteps = 0;
  if (action === 'stop_all') {
    try {
      terminatedSteps = await terminateRunningSteps(db);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  const { error: eventError } = await db.from('ops_events').insert({
    agent_id: 'system',
    kind: 'system.control',
    title: `Runtime mode set to ${updatedControl.mode}`,
    payload: { action, mode: updatedControl.mode },
    visibility: 'internal',
  });
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: action === 'stop_all'
      ? `Runtime mode set to stopped. Terminated ${terminatedSteps} running steps.`
      : `Runtime mode set to ${updatedControl.mode}.`,
    control: toPublicControl(updatedControl),
    terminatedSteps,
  });
}

function parseAction(value: unknown): ControlAction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const action = (value as Record<string, unknown>).action;
  if (
    action === 'run_now' ||
    action === 'pause' ||
    action === 'resume' ||
    action === 'stop_all'
  ) {
    return action;
  }
  return null;
}

async function loadRuntimeControl(db: SupabaseClient): Promise<RuntimeControlPolicy> {
  const { data, error } = await db
    .from('ops_policies')
    .select('value')
    .eq('key', 'runtime_control')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to load runtime control: ${error.message}`);
  }

  const value = data?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_CONTROL;
  }

  const v = value as Record<string, unknown>;
  return {
    mode: v.mode === 'paused' || v.mode === 'stopped' ? v.mode : 'running',
    pollingMinutes: asPositiveNumber(v.pollingMinutes, DEFAULT_CONTROL.pollingMinutes),
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : DEFAULT_CONTROL.updatedAt,
  };
}

async function saveRuntimeControl(
  db: SupabaseClient,
  control: RuntimeControlPolicy,
): Promise<string | null> {
  const { error } = await db.from('ops_policies').upsert({
    key: 'runtime_control',
    value: control,
    description: 'Runtime control state for pause/resume/stop and polling cadence',
  }, {
    onConflict: 'key',
  });
  return error ? error.message : null;
}

function toPublicControl(control: RuntimeControlPolicy): {
  mode: RuntimeMode;
  updatedAt: string;
  pollingMinutes: number;
} {
  return {
    mode: control.mode,
    updatedAt: control.updatedAt,
    pollingMinutes: control.pollingMinutes,
  };
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function terminateRunningSteps(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from('ops_steps')
    .select('id')
    .eq('status', 'running');

  if (error) {
    throw new Error(`Failed to load running steps: ${error.message}`);
  }

  const running = (data as Array<{ id: string }> | null) ?? [];
  let terminated = 0;

  for (const step of running) {
    const { error: completeError } = await db.rpc('complete_step', {
      p_step_id: step.id,
      p_status: 'failed',
      p_output: {
        error: 'Stopped by operator (stop_all).',
        stoppedAt: new Date().toISOString(),
      },
    });
    if (completeError) {
      throw new Error(`Failed to terminate step ${step.id}: ${completeError.message}`);
    }
    terminated++;
  }

  return terminated;
}
