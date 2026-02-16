import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { parseActivationRpcResult } from '@/lib/pitch/activation';
import { runHeartbeatCycle, type HeartbeatRunResult } from '@/lib/heartbeat-runner';

interface ActivateRequestBody {
  forceReplace?: boolean;
  autoRunNow?: boolean;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const db = createSupabaseAdminClient();

  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  let forceReplace = false;
  let autoRunNow = true;
  try {
    const body = (await req.json()) as ActivateRequestBody | null;
    forceReplace = body?.forceReplace === true;
    if (typeof body?.autoRunNow === 'boolean') {
      autoRunNow = body.autoRunNow;
    }
  } catch {
    // Treat empty or non-JSON bodies as the default request.
  }

  const { data, error } = await db.rpc('activate_pitch_session', {
    p_session_id: sessionId,
    p_force_replace: forceReplace,
  });

  if (error) {
    return NextResponse.json(
      { error: `Activation RPC failed: ${error.message}` },
      { status: 500 },
    );
  }

  const result = parseActivationRpcResult(data);
  if (!result) {
    return NextResponse.json(
      { error: 'Activation RPC returned an unexpected response shape.' },
      { status: 500 },
    );
  }

  if (!result.success) {
    const code = result.code;

    if (code === 'runtime_exists') {
      return NextResponse.json(
        {
          code,
          error: result.message,
          requiresConfirmation: true,
        },
        { status: 409 },
      );
    }

    if (code === 'session_not_found') {
      return NextResponse.json({ code, error: result.message }, { status: 404 });
    }

    if (
      code === 'session_not_completed' ||
      code === 'invalid_agent_config' ||
      code === 'invalid_worker_config' ||
      code === 'no_agents' ||
      code === 'no_step_kinds'
    ) {
      return NextResponse.json({ code, error: result.message }, { status: 400 });
    }

    return NextResponse.json({ code, error: result.message }, { status: 500 });
  }

  let autoRunResult: HeartbeatRunResult | null = null;
  let autoRunError: string | null = null;
  if (autoRunNow) {
    try {
      autoRunResult = await runHeartbeatCycle(db, {
        bypassCaps: true,
        source: 'activation_bootstrap',
      });
    } catch (err) {
      autoRunError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    code: result.code,
    message: result.message,
    missionId: result.missionId,
    replacedExisting: result.replacedExisting,
    activatedAt: result.activatedAt,
    autoRun: {
      attempted: autoRunNow,
      succeeded: autoRunNow ? !autoRunError : false,
      error: autoRunError,
      result: autoRunResult,
    },
  });
}
