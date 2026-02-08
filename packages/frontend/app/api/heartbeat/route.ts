import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Cron endpoint for Vercel deployment.
 * Triggers the heartbeat cycle.
 */
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  // Record heartbeat start
  const { data: run } = await db
    .from('ops_action_runs')
    .insert({ action: 'heartbeat' })
    .select('id')
    .single();

  try {
    // Minimal heartbeat: recover stuck steps + check schedule
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuck } = await db
      .from('ops_steps')
      .select('id')
      .eq('status', 'running')
      .lt('reserved_at', thirtyMinAgo);

    if (stuck?.length) {
      await db
        .from('ops_steps')
        .update({ status: 'queued', reserved_by: null, reserved_at: null })
        .in('id', stuck.map((s) => s.id));
    }

    // Emit heartbeat event
    await db.from('ops_events').insert({
      agent_id: 'system',
      kind: 'system.heartbeat',
      title: 'Heartbeat',
      payload: { stepsRecovered: stuck?.length ?? 0 },
      visibility: 'internal',
    });

    // Complete run
    await db
      .from('ops_action_runs')
      .update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        details: { stepsRecovered: stuck?.length ?? 0 },
      })
      .eq('id', run?.id);

    return NextResponse.json({ ok: true, stepsRecovered: stuck?.length ?? 0 });
  } catch (err) {
    await db
      .from('ops_action_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        details: { error: (err as Error).message },
      })
      .eq('id', run?.id);

    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
