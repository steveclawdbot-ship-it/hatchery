import { NextResponse } from 'next/server';
import { runHeartbeatCycle } from '@/lib/heartbeat-runner';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Cron endpoint for Vercel deployment.
 * Triggers the heartbeat cycle.
 */
export async function GET() {
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const { data: controlRow, error: controlError } = await db
    .from('ops_policies')
    .select('value')
    .eq('key', 'runtime_control')
    .single();

  if (controlError && controlError.code !== 'PGRST116') {
    return NextResponse.json({ error: controlError.message }, { status: 500 });
  }

  const mode = (controlRow?.value?.mode as string | undefined) ?? 'running';
  if (mode !== 'running') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      mode,
      message: `Heartbeat skipped because runtime is ${mode}.`,
    });
  }

  try {
    const result = await runHeartbeatCycle(db);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
